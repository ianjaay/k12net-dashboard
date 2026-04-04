import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, Settings, Menu, Search, Bell, ChevronRight, History, LogOut, ArrowLeft, AlertTriangle, Upload, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SessionProvider, useSession } from '../../contexts/SessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { parseGradesExcel } from '../../utils/gradesParser';
import { buildSubjectsByClass } from '../../utils/sectionListParser';
import { processClass, getRulesForYear } from '../../utils/k12RulesEngine';
import type { K12AppData, K12Class, K12Student, AcademicYear, GradeLevel } from '../../types/k12';
import { GRADE_LEVEL_LABELS } from '../../types/k12';

export default function SessionWorkspaceWrapper() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <SessionProvider sessionId={id}>
      <SessionWorkspaceInner />
    </SessionProvider>
  );
}

function SessionWorkspaceInner() {
  const { t } = useTranslation();
  const {
    session, appData, loading,
    userRole, classes, selectedClassId,
    selectedGradeLevel, selectedBranch,
    availableGradeLevels, availableBranches, filteredClasses,
    setSelectedClassId, setSelectedGradeLevel, setSelectedBranch,
    activeStudents, sessionId,
    handleK12DataReady,
  } = useSession();
  const { user, isGuest, logout } = useAuth();
  const { settings: globalSettings, settings } = useGlobalSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f9fd' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8392a5' }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // If no data uploaded yet — show upload interface
  if (!appData || activeStudents.length === 0) {
    return (
      <EmptyStateUpload
        session={session}
        globalSettings={globalSettings}
        navigate={navigate}
        settings={settings}
        handleK12DataReady={handleK12DataReady}
        userRole={userRole}
      />
    );
  }

  const basePath = `/sessions/${sessionId}`;
  const currentPath = location.pathname;

  const navItems = [
    { path: `${basePath}/dashboard`, label: t('navigation.dashboard'), icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { path: `${basePath}/students`, label: 'Élèves', icon: <Users className="w-[18px] h-[18px]" /> },
    { path: `${basePath}/deliberation`, label: t('navigation.deliberation'), icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { path: `${basePath}/history`, label: t('navigation.history'), icon: <History className="w-[18px] h-[18px]" /> },
    ...(userRole !== 'reader'
      ? [{ path: `${basePath}/admin`, label: t('navigation.admin'), icon: <Settings className="w-[18px] h-[18px]" /> }]
      : []),
  ];

  const currentNav = navItems.find(n => currentPath.startsWith(n.path));
  const isStudentDetail = currentPath.includes('/students/');

  // Filter summary for header
  const selectedClass = selectedClassId ? classes.find(c => c.id === selectedClassId) : null;
  const groupName = selectedClass
    ? (selectedClass.displayName || selectedClass.name)
    : selectedGradeLevel
      ? `${GRADE_LEVEL_LABELS[selectedGradeLevel]}${selectedBranch ? ` ${selectedBranch}` : ''} (${filteredClasses.length} cl.)`
      : `${classes.length} classes`;

  return (
    <div className="min-h-screen flex" style={{ background: '#f9f9fd' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 bg-white border-r transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'}`}
        style={{ borderColor: '#e6e7ef' }}>
        <div className="h-[70px] flex items-center px-5 border-b" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-3">
            {globalSettings.logo ? (
              <img src={globalSettings.logo} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <Link to="/sessions" className="text-xl font-bold tracking-tight" style={{ color: '#5556fd' }}>K12net</Link>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>Conseil de Classe</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-[10px] uppercase tracking-widest font-medium mb-3 px-2" style={{ color: '#8392a5' }}>Navigation</p>
          <ul className="space-y-0.5">
            {navItems.map(item => {
              const active = currentPath.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded text-[13px] font-medium transition-all ${active ? 'text-white' : 'hover:bg-[#f0f0ff]'}`}
                    style={active ? { background: '#5556fd', color: 'white' } : { color: '#575d78' }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <hr className="my-5" style={{ borderColor: '#e6e7ef' }} />

          {/* Filters */}
          {classes.length > 1 && (
            <div className="px-2 mb-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest font-medium mb-1" style={{ color: '#8392a5' }}>Filtres</p>
              {/* Grade level */}
              {availableGradeLevels.length > 1 && (
                <div>
                  <label className="text-[10px] font-medium mb-1 block" style={{ color: '#8392a5' }}>Niveau</label>
                  <select
                    value={selectedGradeLevel ?? ''}
                    onChange={e => setSelectedGradeLevel((e.target.value || null) as GradeLevel | null)}
                    className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                  >
                    <option value="">Tous les niveaux</option>
                    {availableGradeLevels.map(lvl => (
                      <option key={lvl} value={lvl}>{GRADE_LEVEL_LABELS[lvl]}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Branch */}
              {availableBranches.length > 0 && (
                <div>
                  <label className="text-[10px] font-medium mb-1 block" style={{ color: '#8392a5' }}>Filière</label>
                  <select
                    value={selectedBranch ?? ''}
                    onChange={e => setSelectedBranch(e.target.value || null)}
                    className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                  >
                    <option value="">Toutes les filières</option>
                    {availableBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Class */}
              <div>
                <label className="text-[10px] font-medium mb-1 block" style={{ color: '#8392a5' }}>Classe</label>
                <select
                  value={selectedClassId ?? ''}
                  onChange={e => setSelectedClassId(e.target.value || null)}
                  className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                  style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                >
                  <option value="">Toutes les classes ({filteredClasses.length})</option>
                  {filteredClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <p className="text-[10px] uppercase tracking-widest font-medium mb-3 px-2" style={{ color: '#8392a5' }}>Actions</p>
          <Link to="/sessions" className="flex items-center gap-3 px-3 py-2.5 rounded text-[13px] font-medium transition-all hover:bg-[#f0f0ff]" style={{ color: '#575d78' }}>
            <ArrowLeft className="w-[18px] h-[18px]" />
            <span>Mes sessions</span>
          </Link>
        </nav>

        <div className="px-5 py-4 border-t" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: isGuest ? '#8392a5' : '#5556fd' }}>
              {isGuest ? '?' : (user?.displayName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#06072d' }}>{isGuest ? 'Invité' : (user?.displayName ?? user?.email)}</p>
              <p className="text-[10px] truncate" style={{ color: '#8392a5' }}>{session?.name}</p>
            </div>
            <button onClick={logout} className="p-1 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }} title="Déconnexion">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-60' : 'ml-0'}`}>
        <header className="h-[70px] bg-white border-b sticky top-0 z-20 flex items-center px-5 gap-4" style={{ borderColor: '#e6e7ef' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5" style={{ color: '#575d78' }} />
          </button>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4" style={{ color: '#c0ccda' }} />
            <input type="text" placeholder="Rechercher..." className="flex-1 text-sm border-0 outline-none bg-transparent" style={{ color: '#373857' }} />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="font-medium" style={{ color: '#06072d' }}>{groupName}</span>
              {appData?.academicYear && (
                <>
                  <ChevronRight className="w-3 h-3" style={{ color: '#c0ccda' }} />
                  <span style={{ color: '#8392a5' }}>{appData.academicYear}-{parseInt(appData.academicYear) + 1}</span>
                </>
              )}
            </div>
            <Bell className="w-5 h-5 cursor-pointer" style={{ color: '#8392a5' }} />
          </div>
        </header>

        {isGuest && (
          <div className="mx-5 mt-3 p-3 rounded flex items-center gap-2 text-sm" style={{ background: '#fff8e1', border: '1px solid #ffc107', color: '#b86e1d' }}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Mode invité — vos données ne seront pas sauvegardées sur le cloud.</span>
            <Link to="/register" className="ml-auto font-semibold text-xs px-3 py-1 rounded text-white shrink-0" style={{ background: '#5556fd' }}>
              Créer un compte
            </Link>
          </div>
        )}

        <div className="px-5 py-3">
          <nav className="text-xs" style={{ color: '#8392a5' }}>
            <span>Pages</span>
            <span className="mx-1.5">{'>'}</span>
            <span>{currentNav?.label ?? 'Dashboard'}</span>
            {isStudentDetail && (
              <>
                <span className="mx-1.5">{'>'}</span>
                <span style={{ color: '#06072d' }}>Détail élève</span>
              </>
            )}
          </nav>
          <h4 className="text-base font-medium mt-1" style={{ color: '#06072d' }}>
            {currentNav?.label ?? 'Tableau de bord'}
          </h4>
        </div>

        <main className="flex-1 px-5 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ─── Empty State Upload Component ───────────────────────────────────────────

interface EmptyStateUploadProps {
  session: { name: string } | null;
  globalSettings: { logo?: string };
  settings: { courseCatalog?: import('../../types/k12').CourseDefinition[]; academicYear?: AcademicYear; rulesConfig?: import('../../types/k12').K12YearRulesConfig; yearConfigs?: Record<AcademicYear, import('../../types/k12').K12YearRulesConfig>; schoolName?: string };
  navigate: ReturnType<typeof useNavigate>;
  handleK12DataReady: (data: K12AppData) => Promise<void>;
  userRole: string;
}

function EmptyStateUpload({ session, globalSettings, settings, navigate, handleK12DataReady, userRole }: EmptyStateUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const subjectsByClass = settings.courseCatalog
        ? buildSubjectsByClass(settings.courseCatalog)
        : undefined;

      const classes = parseGradesExcel(buf, subjectsByClass);
      if (classes.length === 0) {
        throw new Error('Aucune classe trouvée dans le fichier.');
      }

      const academicYear: AcademicYear = settings.academicYear ?? '2024';
      const rulesConfig = settings.rulesConfig ?? getRulesForYear(academicYear, settings.yearConfigs);

      const processedClasses: K12Class[] = classes.map(cls => ({
        ...cls,
        students: processClass(cls.students, rulesConfig),
      }));

      const allStudents: K12Student[] = processedClasses.flatMap(c => c.students);

      const data: K12AppData = {
        academicYear,
        rulesConfig,
        schoolName: settings.schoolName ?? 'Lycée Sainte Marie de Cocody',
        classes: processedClasses,
        courseCatalog: settings.courseCatalog ?? [],
        students: allStudents,
      };

      await handleK12DataReady(data);
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  }, [settings, handleK12DataReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      handleFile(file);
    } else {
      setError('Veuillez déposer un fichier .xlsx');
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
      <header className="bg-white border-b px-5 py-3 flex items-center gap-3" style={{ borderColor: '#e6e7ef' }}>
        <button onClick={() => navigate('/sessions')} className="p-1 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          {globalSettings.logo ? (
            <img src={globalSettings.logo} alt="Logo" className="h-6 w-auto object-contain" />
          ) : (
            <h2 className="text-base font-semibold" style={{ color: '#5556fd' }}>K12net</h2>
          )}
        </div>
        <h2 className="text-base font-semibold" style={{ color: '#06072d' }}>{session?.name ?? 'Session'}</h2>
      </header>
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-center max-w-lg w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f0f0ff' }}>
            <Upload className="w-8 h-8" style={{ color: '#5556fd' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#06072d' }}>Importer les données</h3>
          <p className="text-sm mb-6" style={{ color: '#8392a5' }}>
            Déposez le fichier Excel des moyennes exporté depuis K12net pour commencer l'analyse.
          </p>

          {userRole !== 'reader' && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors hover:border-[#5556fd] hover:bg-[#f8f8ff] mb-4"
              style={{ borderColor: importing ? '#5556fd' : '#e6e7ef' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleInputChange}
              />
              {importing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#5556fd' }} />
                  <p className="text-sm font-medium" style={{ color: '#5556fd' }}>Import en cours…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: '#06072d' }}>
                    Glissez-déposez votre fichier .xlsx ici
                  </p>
                  <p className="text-xs" style={{ color: '#8392a5' }}>
                    ou cliquez pour sélectionner
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg text-left" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
              <p className="text-xs" style={{ color: '#991b1b' }}>{error}</p>
            </div>
          )}

          {!settings.courseCatalog && (
            <p className="text-xs mt-4" style={{ color: '#8392a5' }}>
              Conseil : importez d'abord la <strong>liste des sections</strong> depuis{' '}
              <button onClick={() => navigate('/admin')} className="underline font-medium" style={{ color: '#5556fd' }}>
                l'administration globale
              </button>{' '}
              pour activer les coefficients.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
