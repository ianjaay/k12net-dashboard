import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getSession } from '../lib/firestore';
import { saveSessionAppData, loadSessionAppData } from '../lib/sessionStorage';
import type { SessionDoc, SessionRole } from '../types';
import type {
  K12Student, K12Class, K12AppData,
  TermView, GradeLevel, Branch,
} from '../types/k12';
import { computeClassStats, type K12ClassStats } from '../utils/k12RulesEngine';

// ─── Context State ──────────────────────────────────────────────────────────

interface SessionState {
  sessionId: string;
  session: ({ id: string } & SessionDoc) | null;
  appData: K12AppData | null;
  loading: boolean;
  userRole: SessionRole;
  // Class & term selection
  classes: K12Class[];
  selectedGradeLevel: GradeLevel | null;  // null = all levels
  selectedBranch: Branch | null;          // null = all branches
  selectedClassId: string | null;         // null = all classes
  termView: TermView;
  isMultiClass: boolean;
  // Derived filter options
  availableGradeLevels: GradeLevel[];
  availableBranches: Branch[];
  filteredClasses: K12Class[];
  // Computed
  activeStudents: K12Student[];
  classStats: K12ClassStats | null;
  // Actions
  setSelectedGradeLevel: (level: GradeLevel | null) => void;
  setSelectedBranch: (branch: Branch | null) => void;
  setSelectedClassId: (id: string | null) => void;
  setTermView: (v: TermView) => void;
  handleK12DataReady: (data: K12AppData) => Promise<void>;
  refreshData: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<({ id: string } & SessionDoc) | null>(null);
  const [appData, setAppData] = useState<K12AppData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedGradeLevel, setSelectedGradeLevelRaw] = useState<GradeLevel | null>(null);
  const [selectedBranch, setSelectedBranchRaw] = useState<Branch | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [termView, setTermView] = useState<TermView>('ANNUAL');

  const userRole: SessionRole = useMemo(() => {
    if (!session || !user) return 'reader';
    return session.members[user.uid] ?? 'reader';
  }, [session, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, stored] = await Promise.all([
        getSession(sessionId),
        loadSessionAppData(sessionId),
      ]);
      setSession(sess);
      if (stored) {
        setAppData(stored);
        setSelectedClassId(stored.classes.length > 1 ? null : (stored.classes[0]?.id ?? null));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadData(); }, [loadData]);

  const classes = useMemo(() => appData?.classes ?? [], [appData]);
  const isMultiClass = classes.length > 1;

  // Derived filter options
  const availableGradeLevels: GradeLevel[] = useMemo(() => {
    const levels = new Set(classes.map(c => c.gradeLevel));
    return [...levels].sort();
  }, [classes]);

  const availableBranches: Branch[] = useMemo(() => {
    const filtered = selectedGradeLevel
      ? classes.filter(c => c.gradeLevel === selectedGradeLevel)
      : classes;
    const branches = new Set(filtered.map(c => c.branch).filter((b): b is Branch => b !== null));
    return [...branches].sort();
  }, [classes, selectedGradeLevel]);

  const filteredClasses: K12Class[] = useMemo(() => {
    let filtered = classes;
    if (selectedGradeLevel) filtered = filtered.filter(c => c.gradeLevel === selectedGradeLevel);
    if (selectedBranch) filtered = filtered.filter(c => c.branch === selectedBranch);
    return filtered;
  }, [classes, selectedGradeLevel, selectedBranch]);

  // Cascade: reset branch & class when grade level changes
  const setSelectedGradeLevel = useCallback((level: GradeLevel | null) => {
    setSelectedGradeLevelRaw(level);
    setSelectedBranchRaw(null);
    setSelectedClassId(null);
  }, []);

  // Cascade: reset class when branch changes
  const setSelectedBranch = useCallback((branch: Branch | null) => {
    setSelectedBranchRaw(branch);
    setSelectedClassId(null);
  }, []);

  const activeStudents: K12Student[] = useMemo(() => {
    if (!appData) return [];
    // Specific class selected
    if (selectedClassId) {
      const cls = classes.find(c => c.id === selectedClassId);
      return cls?.students ?? [];
    }
    // Filter by grade level + branch
    if (selectedGradeLevel || selectedBranch) {
      return filteredClasses.flatMap(c => c.students);
    }
    // All students
    return appData.students;
  }, [appData, selectedClassId, selectedGradeLevel, selectedBranch, classes, filteredClasses]);

  const classStats: K12ClassStats | null = useMemo(() => {
    if (activeStudents.length === 0) return null;
    return computeClassStats(activeStudents);
  }, [activeStudents]);

  const handleK12DataReady = useCallback(async (data: K12AppData) => {
    setAppData(data);
    setSelectedClassId(data.classes.length > 1 ? null : (data.classes[0]?.id ?? null));
    await saveSessionAppData(sessionId, data);
  }, [sessionId]);

  return (
    <SessionContext.Provider value={{
      sessionId, session, appData, loading, userRole,
      classes, selectedGradeLevel, selectedBranch, selectedClassId,
      termView, isMultiClass,
      availableGradeLevels, availableBranches, filteredClasses,
      activeStudents, classStats,
      setSelectedGradeLevel, setSelectedBranch, setSelectedClassId, setTermView,
      handleK12DataReady,
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
