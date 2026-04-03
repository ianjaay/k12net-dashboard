import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useGlobalSettings } from './GlobalSettingsContext';
import { getSession, loadSessionClasses, saveSessionData, createSnapshot } from '../lib/firestore';
import { pairClasses, calculateStudents, applyCreditOverrides } from '../utils/calculator';
import type {
  AppData, SessionDoc, SessionRole, ClassInfo, 
  CreditOverride, MultiClassData, Student, SemesterView, TermConfig,
  ValidationRules,
} from '../types';
import { DEFAULT_VALIDATION_RULES } from '../types';
import { normalizeSemester, DEFAULT_TERM_CONFIG, filterCoursesByHomeroom } from '../utils/excelParser';
import { annualToStudent, assignRanks } from '../utils/calculator';

interface SessionState {
  sessionId: string;
  session: ({ id: string } & SessionDoc) | null;
  appData: AppData | null;
  loading: boolean;
  userRole: SessionRole;
  // Filters
  selectedClassIdx: number;
  filterNiveau: string;
  filterFiliere: string;
  semesterView: SemesterView;
  hasBothSemesters: boolean;
  isMultiClass: boolean;
  filteredClasses: ClassInfo[];
  activeData: AppData | null;
  // Actions
  setSelectedClassIdx: (idx: number) => void;
  setFilterNiveau: (v: string) => void;
  setFilterFiliere: (v: string) => void;
  setSemesterView: (v: SemesterView) => void;
  handleDataReady: (data: AppData) => Promise<void>;
  handleCreditOverridesChange: (overrides: CreditOverride[]) => void;
  handleTermConfigChange: (termConfig: TermConfig) => void;
  refreshData: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

function getDefaultSelectedClassIdx(classCount: number): number {
  return classCount > 1 ? -1 : 0;
}

export function SessionProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const { user } = useAuth();
  const { settings: globalSettings } = useGlobalSettings();
  const rules: ValidationRules = globalSettings.validationRules ?? DEFAULT_VALIDATION_RULES;
  const [session, setSession] = useState<({ id: string } & SessionDoc) | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters (same as old App.tsx)
  const [selectedClassIdx, setSelectedClassIdx] = useState(0);
  const [filterNiveau, setFilterNiveau] = useState('ALL');
  const [filterFiliere, setFilterFiliere] = useState('ALL');
  const [semesterView, setSemesterView] = useState<SemesterView>('S1');

  const userRole: SessionRole = useMemo(() => {
    if (!session || !user) return 'reader';
    return session.members[user.uid] ?? 'reader';
  }, [session, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await getSession(sessionId);
      setSession(sess);
      if (!sess?.data) {
        setAppData(null);
        return;
      }

      const classDocs = await loadSessionClasses(sessionId);
      if (classDocs.length === 0) {
        setAppData({ courses: sess.data.courses, parsedExcel: null, students: null, multiClass: null, creditOverrides: sess.data.creditOverrides, termConfig: sess.data.termConfig ?? DEFAULT_TERM_CONFIG });
        return;
      }

      // Reconstruct ClassInfo[] from ClassDocs, recalculating students
      // so that any calculator rule changes are applied immediately.
      const baseCourses = sess.data.courses;
      const overrides = sess.data.creditOverrides ?? [];
      const hasHomerooms = baseCourses
        ? Object.values(baseCourses.ues).some(u => u.homerooms.length > 0)
        : false;

      const classes: ClassInfo[] = classDocs.map(c => {
        let filteredCourses = baseCourses;
        if (filteredCourses && hasHomerooms) {
          filteredCourses = filterCoursesByHomeroom(filteredCourses, c.groupName);
        }
        if (filteredCourses && overrides.length > 0) {
          filteredCourses = applyCreditOverrides(filteredCourses, overrides, c.groupName);
        }
        const students = filteredCourses
          ? calculateStudents(c.parsedExcel, filteredCourses, rules)
          : c.students;

        return {
          sheetName: c.sheetName,
          groupName: c.groupName,
          niveau: c.niveau,
          filiere: c.filiere,
          semester: c.semester,
          date: c.date,
          level: c.level,
          parsedExcel: c.parsedExcel,
          students,
        };
      });

      const classPairs = pairClasses(classes, rules);
      const allNiveaux = [...new Set(classes.map(c => c.niveau))].sort();
      const allFilieres = [...new Set(classes.map(c => c.filiere))].sort();

      const multiClass: MultiClassData = {
        courses: sess.data.courses,
        classes,
        classPairs,
        allNiveaux,
        allFilieres,
      };

      setAppData({
        courses: sess.data.courses,
        parsedExcel: classes[0]?.parsedExcel ?? null,
        students: classes[0]?.students ?? null,
        multiClass,
        creditOverrides: sess.data.creditOverrides,
        termConfig: sess.data.termConfig ?? DEFAULT_TERM_CONFIG,
      });
      setSelectedClassIdx(getDefaultSelectedClassIdx(classes.length));
    } finally {
      setLoading(false);
    }
  }, [sessionId, rules]);

  useEffect(() => { loadData(); }, [loadData]);

  const isMultiClass = !!appData?.multiClass;

  const hasBothSemesters = useMemo(() => {
    if (!appData?.multiClass) return false;
    // Check via normalized semester labels
    const semesters = new Set(appData.multiClass.classes.map(c => normalizeSemester(c.semester)).filter(Boolean));
    if (semesters.has('S1') && semesters.has('S2')) return true;
    // Check via availableTerms across all parsed sheets
    const allTerms = new Set(
      appData.multiClass.classes.flatMap(c => c.parsedExcel.availableTerms)
    );
    if (allTerms.has('S1') && allTerms.has('S2')) return true;
    // Check if any class pair was successfully paired
    if (appData.multiClass.classPairs.some(p => p.s1 && p.s2)) return true;
    // Check if user configured 2+ terms
    if (appData.termConfig?.terms?.length >= 2) return true;
    return false;
  }, [appData?.multiClass, appData?.termConfig]);

  const filteredClasses = useMemo(() => {
    if (!appData?.multiClass) return [];
    return appData.multiClass.classes.filter(c => {
      if (semesterView !== 'ANNUAL') {
        const sem = normalizeSemester(c.semester);
        if (sem && sem !== semesterView) return false;
      }
      return (filterNiveau === 'ALL' || c.niveau === filterNiveau) &&
        (filterFiliere === 'ALL' || c.filiere === filterFiliere);
    });
  }, [appData?.multiClass, semesterView, filterNiveau, filterFiliere]);

  const filteredPairs = useMemo(() => {
    if (!appData?.multiClass || semesterView !== 'ANNUAL') return [];
    return appData.multiClass.classPairs.filter(p =>
      (filterNiveau === 'ALL' || p.niveau === filterNiveau) &&
      (filterFiliere === 'ALL' || p.filiere === filterFiliere)
    );
  }, [appData?.multiClass, semesterView, filterNiveau, filterFiliere]);

  const isAllClasses = selectedClassIdx === -1;

  const activeData: AppData | null = useMemo(() => {
    if (!appData) return null;
    if (!isMultiClass) {
      if (appData.students) assignRanks(appData.students, (s: Student) => s.semesterAverage);
      return appData;
    }

    const activeClass = (() => {
      if (semesterView === 'ANNUAL') return null;
      if (isAllClasses || filteredClasses.length === 0) return null;
      const idx = Math.min(selectedClassIdx, filteredClasses.length - 1);
      return filteredClasses[idx] ?? null;
    })();

    const activePair = (() => {
      if (semesterView !== 'ANNUAL' || filteredPairs.length === 0 || isAllClasses) return null;
      const idx = Math.min(selectedClassIdx, filteredPairs.length - 1);
      return filteredPairs[idx] ?? null;
    })();

    let result: AppData;

    if (isAllClasses) {
      if (semesterView === 'ANNUAL') {
        if (filteredPairs.length === 0) return null;
        const allStudents = filteredPairs.flatMap(p => p.annualStudents.map(annualToStudent));
        const baseParsed = (filteredPairs[0]?.s1 ?? filteredPairs[0]?.s2)?.parsedExcel ?? appData.parsedExcel;
        result = { ...appData, parsedExcel: baseParsed, students: allStudents };
      } else {
        if (filteredClasses.length === 0) return null;
        const allStudents = filteredClasses.flatMap(c => c.students);
        result = { ...appData, parsedExcel: filteredClasses[0]?.parsedExcel ?? appData.parsedExcel, students: allStudents };
      }
    } else if (semesterView === 'ANNUAL' && activePair) {
      const adaptedStudents = activePair.annualStudents.map(annualToStudent);
      const baseParsed = (activePair.s1 ?? activePair.s2)!.parsedExcel;
      result = { ...appData, parsedExcel: baseParsed, students: adaptedStudents };
    } else if (activeClass) {
      result = { ...appData, parsedExcel: activeClass.parsedExcel, students: activeClass.students };
    } else {
      return null;
    }

    // Always re-rank final students by semesterAverage
    if (result.students) assignRanks(result.students, (s: Student) => s.semesterAverage);
    return result;
  }, [appData, isMultiClass, semesterView, selectedClassIdx, isAllClasses, filteredClasses, filteredPairs]);

  const handleDataReady = useCallback(async (data: AppData) => {
    setAppData(data);
    setSelectedClassIdx(getDefaultSelectedClassIdx(data.multiClass?.classes.length ?? 0));
    setFilterNiveau('ALL');
    setFilterFiliere('ALL');

    // Persist to Firestore
    if (data.multiClass && data.courses) {
      await saveSessionData(sessionId, data.courses, data.creditOverrides, data.multiClass.classes, data.termConfig);
      await createSnapshot(sessionId, `Upload du ${new Date().toLocaleDateString('fr-FR')}`);
    } else if (data.courses) {
      await saveSessionData(sessionId, data.courses, data.creditOverrides, [], data.termConfig);
    }
  }, [sessionId]);

  const handleCreditOverridesChange = useCallback((overrides: CreditOverride[]) => {
    if (appData) setAppData({ ...appData, creditOverrides: overrides });
  }, [appData]);

  const handleTermConfigChange = useCallback(async (termConfig: TermConfig) => {
    if (appData) {
      const updated = { ...appData, termConfig };
      setAppData(updated);
      // Persist to Firestore
      if (updated.courses) {
        await saveSessionData(
          sessionId,
          updated.courses,
          updated.creditOverrides,
          updated.multiClass?.classes ?? [],
          termConfig,
        );
      }
    }
  }, [appData, sessionId]);

  return (
    <SessionContext.Provider value={{
      sessionId, session, appData, loading, userRole,
      selectedClassIdx, filterNiveau, filterFiliere, semesterView,
      hasBothSemesters, isMultiClass, filteredClasses, activeData,
      setSelectedClassIdx, setFilterNiveau, setFilterFiliere, setSemesterView,
      handleDataReady, handleCreditOverridesChange, handleTermConfigChange,
      refreshData: loadData,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
