import { useState, useMemo } from 'react';
import { LayoutDashboard, Users, ClipboardList, Upload, ChevronRight, Settings, Menu, Search, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import StudentDetail from './components/StudentDetail';
import Deliberation from './components/Deliberation';
import ClassSelector from './components/ClassSelector';
import Admin from './components/Admin';
import type { AppData, AppView, Student, SemesterView, CreditOverride, TermConfig } from './types';
import { normalizeSemester } from './utils/excelParser';
import { annualToStudent, assignRanks } from './utils/calculator';
import { useGlobalSettings } from './contexts/GlobalSettingsContext';
import { useStudentPhotos } from './contexts/StudentPhotosContext';

export default function App() {
  const { t } = useTranslation();
  const [data, setData] = useState<AppData | null>(null);
  const [view, setView] = useState<AppView>('upload');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Multi-class selection state
  const [selectedClassIdx, setSelectedClassIdx] = useState(0);
  const [filterNiveau, setFilterNiveau] = useState('ALL');
  const [filterFiliere, setFilterFiliere] = useState('ALL');
  const [semesterView, setSemesterView] = useState<SemesterView>('S1');

  // Use global settings for logo
  const { settings: globalSettings } = useGlobalSettings();
  const { getPhoto } = useStudentPhotos();

  const isMultiClass = !!data?.multiClass;

  // Check if we have both semesters
  const hasBothSemesters = useMemo(() => {
    if (!data?.multiClass) return false;
    // Check via normalized semester labels
    const semesters = new Set(
      data.multiClass.classes.map(c => normalizeSemester(c.semester)).filter(Boolean)
    );
    if (semesters.has('S1') && semesters.has('S2')) return true;
    // Check via availableTerms across all parsed sheets
    const allTerms = new Set(
      data.multiClass.classes.flatMap(c => c.parsedExcel.availableTerms)
    );
    if (allTerms.has('S1') && allTerms.has('S2')) return true;
    // Check if any class pair was successfully paired
    if (data.multiClass.classPairs.some(p => p.s1 && p.s2)) return true;
    // Check if user configured 2+ terms
    if (data.termConfig?.terms?.length >= 2) return true;
    return false;
  }, [data?.multiClass, data?.termConfig]);

  // Filter classes by semester + niveau + filiere
  const filteredClasses = useMemo(() => {
    if (!data?.multiClass) return [];
    return data.multiClass.classes.filter(c => {
      if (semesterView !== 'ANNUAL') {
        const sem = normalizeSemester(c.semester);
        if (sem && sem !== semesterView) return false;
      }
      return (filterNiveau === 'ALL' || c.niveau === filterNiveau) &&
        (filterFiliere === 'ALL' || c.filiere === filterFiliere);
    });
  }, [data?.multiClass, semesterView, filterNiveau, filterFiliere]);

  // Filter class pairs for annual view
  const filteredPairs = useMemo(() => {
    if (!data?.multiClass || semesterView !== 'ANNUAL') return [];
    return data.multiClass.classPairs.filter(p =>
      (filterNiveau === 'ALL' || p.niveau === filterNiveau) &&
      (filterFiliere === 'ALL' || p.filiere === filterFiliere)
    );
  }, [data?.multiClass, semesterView, filterNiveau, filterFiliere]);

  // Is "all classes" mode selected?
  const isAllClasses = selectedClassIdx === -1;

  // Active class or pair
  const activeClass = useMemo(() => {
    if (!isMultiClass) return null;
    if (semesterView === 'ANNUAL') return null;
    if (isAllClasses) return null;
    if (filteredClasses.length === 0) return null;
    const idx = Math.min(selectedClassIdx, filteredClasses.length - 1);
    return filteredClasses[idx] ?? null;
  }, [isMultiClass, semesterView, filteredClasses, selectedClassIdx, isAllClasses]);

  const activePair = useMemo(() => {
    if (semesterView !== 'ANNUAL' || filteredPairs.length === 0) return null;
    if (isAllClasses) return null;
    const idx = Math.min(selectedClassIdx, filteredPairs.length - 1);
    return filteredPairs[idx] ?? null;
  }, [semesterView, filteredPairs, selectedClassIdx, isAllClasses]);

  // Derive activeData
  const activeData: AppData | null = useMemo(() => {
    if (!data) return null;
    if (!isMultiClass) {
      // Always re-rank even for single class (rank by semesterAverage)
      if (data.students) assignRanks(data.students, s => s.semesterAverage);
      return data;
    }

    let result: AppData;

    if (isAllClasses) {
      if (semesterView === 'ANNUAL') {
        if (filteredPairs.length === 0) return null;
        const allStudents = filteredPairs.flatMap(p => p.annualStudents.map(annualToStudent));
        const baseParsed = (filteredPairs[0]?.s1 ?? filteredPairs[0]?.s2)?.parsedExcel ?? data.parsedExcel;
        result = { ...data, parsedExcel: baseParsed, students: allStudents };
      } else {
        if (filteredClasses.length === 0) return null;
        const allStudents = filteredClasses.flatMap(c => c.students);
        result = { ...data, parsedExcel: filteredClasses[0]?.parsedExcel ?? data.parsedExcel, students: allStudents };
      }
    } else if (semesterView === 'ANNUAL' && activePair) {
      const adaptedStudents = activePair.annualStudents.map(annualToStudent);
      const baseParsed = (activePair.s1 ?? activePair.s2)!.parsedExcel;
      result = { ...data, parsedExcel: baseParsed, students: adaptedStudents };
    } else if (activeClass) {
      result = { ...data, parsedExcel: activeClass.parsedExcel, students: activeClass.students };
    } else {
      return null;
    }

    // Always re-rank final students by semesterAverage
    if (result.students) assignRanks(result.students, s => s.semesterAverage);
    return result;
  }, [data, isMultiClass, semesterView, activeClass, activePair, isAllClasses, filteredClasses, filteredPairs]);

  const handleDataReady = (d: AppData) => {
    setData(d);
    if (view === 'upload' || view === 'admin') setView('dashboard');
    setSelectedClassIdx(0);
    setFilterNiveau('ALL');
    setFilterFiliere('ALL');
  };

  const handleCreditOverridesChange = (overrides: CreditOverride[]) => {
    if (data) {
      setData({ ...data, creditOverrides: overrides });
    }
  };

  const handleTermConfigChange = (termConfig: TermConfig) => {
    if (data) {
      setData({ ...data, termConfig });
    }
  };

  // Logo is now handled globally, no need for local handler

  const handleStudentClick = (s: Student) => {
    setSelectedStudent(s);
    setView('student-detail');
  };

  const handleClassChange = (idx: number) => {
    setSelectedClassIdx(idx);
    setSelectedStudent(null);
    if (view === 'student-detail') setView('students');
  };

  if (!data || view === 'upload') {
    return <FileUpload onDataReady={handleDataReady} courses={globalSettings.courses} validationRules={globalSettings.validationRules} />;
  }

  const groupName = isAllClasses
    ? `${semesterView === 'ANNUAL' ? filteredPairs.length : filteredClasses.length} classes`
    : semesterView === 'ANNUAL' && activePair
      ? activePair.groupName
      : activeClass?.groupName ?? data.parsedExcel?.groupName ?? '';
  const semester = semesterView === 'ANNUAL'
    ? 'Annuel'
    : activeClass?.semester ?? data.parsedExcel?.semester ?? '';

  // Short label for semester display on screens (SEM1, SEM2, Annuel)
  // const semesterLabel = semesterView === 'ANNUAL'
  //   ? 'Annuel'
  //   : semesterView === 'S2' ? 'SEM2' : 'SEM1';

  const navItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t('navigation.dashboard'), icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: 'students', label: t('navigation.students'), icon: <Users className="w-[18px] h-[18px]" /> },
    { id: 'deliberation', label: t('navigation.deliberation'), icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { id: 'admin', label: 'Administration', icon: <Settings className="w-[18px] h-[18px]" /> },
  ];

  const currentView = view === 'student-detail' ? 'students' : view;

  return (
    <div className="min-h-screen flex" style={{ background: '#f9f9fd' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 bg-white border-r transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'}`}
        style={{ borderColor: '#e6e7ef' }}>
        {/* Sidebar header */}
        <div className="h-[70px] flex items-center px-5 border-b" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-3">
            {globalSettings.logo ? (
              <img 
                src={globalSettings.logo} 
                alt="Logo" 
                className="h-8 w-auto object-contain"
              />
            ) : (
              <a className="text-xl font-bold tracking-tight" style={{ color: '#5556fd' }}>EMSP</a>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>{t('app.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-[10px] uppercase tracking-widest font-medium mb-3 px-2" style={{ color: '#8392a5' }}>{t('navigation.navigation')}</p>
          <ul className="space-y-0.5">
            {navItems.map(item => {
              const active = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-[13px] font-medium transition-all ${
                      active
                        ? 'text-white'
                        : 'hover:bg-[#f0f0ff]'
                    }`}
                    style={active
                      ? { background: '#5556fd', color: 'white' }
                      : { color: '#575d78' }
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <hr className="my-5" style={{ borderColor: '#e6e7ef' }} />

          <p className="text-[10px] uppercase tracking-widest font-medium mb-3 px-2" style={{ color: '#8392a5' }}>Actions</p>
          <button
            onClick={() => { setData(null); setView('upload'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-[13px] font-medium transition-all hover:bg-[#f0f0ff]"
            style={{ color: '#575d78' }}
          >
            <Upload className="w-[18px] h-[18px]" />
            <span>Nouveau fichier</span>
          </button>
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#5556fd' }}>
              FS
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#06072d' }}>FS MENUM</p>
              <p className="text-[10px] truncate" style={{ color: '#8392a5' }}>EMSP Abidjan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-60' : 'ml-0'}`}>
        {/* Header */}
        <header className="h-[70px] bg-white border-b sticky top-0 z-20 flex items-center px-5 gap-4"
          style={{ borderColor: '#e6e7ef' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" style={{ color: '#575d78' }} />
          </button>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4" style={{ color: '#c0ccda' }} />
            <input
              type="text"
              placeholder="Rechercher..."
              className="flex-1 text-sm border-0 outline-none bg-transparent"
              style={{ color: '#373857' }}
            />
          </div>

          {/* Right side info */}
          <div className="ml-auto flex items-center gap-4">
            {/* Group info */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="font-medium" style={{ color: '#06072d' }}>{groupName}</span>
              {semester && (
                <>
                  <ChevronRight className="w-3 h-3" style={{ color: '#c0ccda' }} />
                  <span style={{ color: '#8392a5' }}>{semester}</span>
                </>
              )}
            </div>
            <Bell className="w-5 h-5 cursor-pointer" style={{ color: '#8392a5' }} />
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#637382' }}>
              A
            </div>
          </div>
        </header>

        {/* Class selector bar */}
        {isMultiClass && data.multiClass && view !== 'admin' && (
          <ClassSelector
            classes={data.multiClass.classes}
            classPairs={data.multiClass.classPairs}
            allNiveaux={data.multiClass.allNiveaux}
            allFilieres={data.multiClass.allFilieres}
            selectedIndex={selectedClassIdx}
            filterNiveau={filterNiveau}
            filterFiliere={filterFiliere}
            semesterView={semesterView}
            hasBothSemesters={hasBothSemesters}
            onSelectClass={handleClassChange}
            onFilterNiveau={setFilterNiveau}
            onFilterFiliere={setFilterFiliere}
            onSemesterViewChange={setSemesterView}
          />
        )}

        {/* Breadcrumb */}
        <div className="px-5 py-3">
          <nav className="text-xs" style={{ color: '#8392a5' }}>
            <span>Pages</span>
            <span className="mx-1.5">{'>'}</span>
            <span>{navItems.find(n => n.id === currentView)?.label ?? 'Dashboard'}</span>
            {view === 'student-detail' && selectedStudent && (
              <>
                <span className="mx-1.5">{'>'}</span>
                <span style={{ color: '#06072d' }}>{selectedStudent.name}</span>
              </>
            )}
          </nav>
          <h4 className="text-base font-medium mt-1" style={{ color: '#06072d' }}>
            {view === 'student-detail' && selectedStudent
              ? selectedStudent.name
              : navItems.find(n => n.id === currentView)?.label ?? 'Tableau de bord'}
          </h4>
        </div>

        {/* Main content area */}
        <main className="flex-1 px-5 pb-6">
          {view === 'dashboard' && activeData && (
            <Dashboard
              data={activeData}
              onStudentClick={handleStudentClick}
            />
          )}
          {view === 'students' && activeData && (
            <StudentList
              students={activeData.students!}
              onStudentClick={handleStudentClick}
              hasBothSemesters={hasBothSemesters}
              semesterView={semesterView}
              onSemesterViewChange={setSemesterView}
            />
          )}
          {view === 'student-detail' && selectedStudent && (
            <StudentDetail
              student={selectedStudent}
              classStudents={activeData?.students ?? []}
              onBack={() => setView('students')}
              photoUrl={getPhoto(selectedStudent.matricule)}
            />
          )}
          {view === 'deliberation' && activeData && (
            <Deliberation
              data={activeData}
              onStudentClick={handleStudentClick}
              hasBothSemesters={hasBothSemesters}
              semesterView={semesterView}
              onSemesterViewChange={setSemesterView}
            />
          )}
          {view === 'admin' && (
            <Admin
              data={data}
              onDataReady={handleDataReady}
              onCreditOverridesChange={handleCreditOverridesChange}
              onTermConfigChange={handleTermConfigChange}
              globalCourses={globalSettings.courses}
              validationRules={globalSettings.validationRules}
            />
          )}
        </main>
      </div>
    </div>
  );
}
