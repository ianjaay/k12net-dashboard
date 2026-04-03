import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, LogOut, Settings } from 'lucide-react';
import GlobalAdmin from '../GlobalAdmin';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import LanguageSwitcher from '../LanguageSwitcher';

export default function GlobalAdminPage() {
  const { settings, updateSettings } = useGlobalSettings();
  const { user, isGuest, logout, appRole } = useAuth();
  const navigate = useNavigate();

  if (appRole !== 'admin') {
    return <Navigate to="/sessions" replace />;
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
      <header className="bg-white border-b" style={{ borderColor: '#e6e7ef' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/sessions')}
              className="p-2 rounded hover:bg-[#f9f9fd] transition-colors"
              style={{ color: '#8392a5' }}
              title="Retour aux sessions"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {settings.logo ? (
              <img
                src={settings.logo}
                alt="Logo"
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="p-2 rounded-lg" style={{ background: '#f0f0ff' }}>
                <BookOpen className="w-5 h-5" style={{ color: '#5556fd' }} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold" style={{ color: '#06072d' }}>Administration centrale</h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#f0f0ff', color: '#5556fd' }}>
                  <Settings className="w-3 h-3" />
                  Global
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: '#8392a5' }}>
                Paramètres globaux, utilisateurs et configuration de l'application
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <LanguageSwitcher />
            <Link to="/sessions" className="text-sm px-3 py-1.5 rounded hover:bg-[#f0f0ff] transition-colors" style={{ color: '#5556fd' }}>
              Mes sessions
            </Link>
            <span className="text-sm max-w-[220px] truncate" style={{ color: '#575d78' }}>
              {isGuest ? 'Invité' : (user?.displayName || user?.email)}
            </span>
            <button
              onClick={logout}
              className="p-2 rounded hover:bg-[#f9f9fd]"
              style={{ color: '#8392a5' }}
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <GlobalAdmin
          settings={settings}
          onSettingsChange={updateSettings}
        />
      </main>
    </div>
  );
}