import { useState } from 'react';
import { useParams, useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, Settings, Menu, Search, Bell, ChevronRight, History, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SessionProvider, useSession } from '../../contexts/SessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import ClassSelector from '../ClassSelector';
import FileUpload from '../FileUpload';

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
    session, appData, loading, isMultiClass,
    userRole,
    selectedClassIdx, filterNiveau, filterFiliere, semesterView, hasBothSemesters,
    setSelectedClassIdx, setFilterNiveau, setFilterFiliere, setSemesterView,
    handleDataReady, filteredClasses, sessionId,
  } = useSession();
  const { user, isGuest, logout } = useAuth();
  const { settings: globalSettings } = useGlobalSettings();
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

  // If no data uploaded yet, show upload page
  if (!appData?.students) {
    return (
      <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
        <header className="bg-white border-b px-5 py-3 flex items-center gap-3" style={{ borderColor: '#e6e7ef' }}>
          <button onClick={() => navigate('/sessions')} className="p-1 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {globalSettings.logo ? (
              <img 
                src={globalSettings.logo} 
                alt="Logo" 
                className="h-6 w-auto object-contain"
              />
            ) : (
              <h2 className="text-base font-semibold" style={{ color: '#06072d' }}>EMSP</h2>
            )}
          </div>
          <h2 className="text-base font-semibold" style={{ color: '#06072d' }}>{session?.name ?? 'Session'}</h2>
        </header>
        <FileUpload onDataReady={handleDataReady} courses={globalSettings.courses} validationRules={globalSettings.validationRules} />
      </div>
    );
  }

  const basePath = `/sessions/${sessionId}`;
  const currentPath = location.pathname;

  const navItems = [
    { path: `${basePath}/dashboard`, label: t('navigation.dashboard'), icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { path: `${basePath}/students`, label: t('navigation.students'), icon: <Users className="w-[18px] h-[18px]" /> },
    { path: `${basePath}/deliberation`, label: t('navigation.deliberation'), icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { path: `${basePath}/history`, label: t('navigation.history'), icon: <History className="w-[18px] h-[18px]" /> },
    ...(userRole !== 'reader'
      ? [{ path: `${basePath}/admin`, label: t('navigation.admin'), icon: <Settings className="w-[18px] h-[18px]" /> }]
      : []),
  ];

  const currentNav = navItems.find(n => currentPath.startsWith(n.path));
  const isStudentDetail = currentPath.includes('/students/');

  // Group name for header
  const isAllClasses = selectedClassIdx === -1;
  const activeClass = isMultiClass && !isAllClasses && filteredClasses.length > 0
    ? filteredClasses[Math.min(selectedClassIdx, filteredClasses.length - 1)]
    : null;
  const groupName = isAllClasses
    ? `${filteredClasses.length} classes`
    : activeClass?.groupName ?? appData?.parsedExcel?.groupName ?? '';
  const semester = semesterView === 'ANNUAL'
    ? 'Annuel'
    : activeClass?.semester ?? appData?.parsedExcel?.semester ?? '';

  const showClassSelector = isMultiClass && appData.multiClass && !currentPath.includes('/admin') && !currentPath.includes('/history');

  return (
    <div className="min-h-screen flex" style={{ background: '#f9f9fd' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 bg-white border-r transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'}`}
        style={{ borderColor: '#e6e7ef' }}>
        <div className="h-[70px] flex items-center px-5 border-b" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-3">
            {globalSettings.logo ? (
              <img 
                src={globalSettings.logo} 
                alt="Logo" 
                className="h-8 w-auto object-contain"
              />
            ) : (
              <Link to="/sessions" className="text-xl font-bold tracking-tight" style={{ color: '#5556fd' }}>EMSP</Link>
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
              {semester && (
                <>
                  <ChevronRight className="w-3 h-3" style={{ color: '#c0ccda' }} />
                  <span style={{ color: '#8392a5' }}>{semester}</span>
                </>
              )}
            </div>
            <Bell className="w-5 h-5 cursor-pointer" style={{ color: '#8392a5' }} />
          </div>
        </header>

        {showClassSelector && (
          <ClassSelector
            classes={appData.multiClass!.classes}
            classPairs={appData.multiClass!.classPairs}
            allNiveaux={appData.multiClass!.allNiveaux}
            allFilieres={appData.multiClass!.allFilieres}
            selectedIndex={selectedClassIdx}
            filterNiveau={filterNiveau}
            filterFiliere={filterFiliere}
            semesterView={semesterView}
            hasBothSemesters={hasBothSemesters}
            onSelectClass={setSelectedClassIdx}
            onFilterNiveau={setFilterNiveau}
            onFilterFiliere={setFilterFiliere}
            onSemesterViewChange={setSemesterView}
          />
        )}

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
                <span style={{ color: '#06072d' }}>Détail étudiant</span>
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
