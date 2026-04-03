import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, BookOpen, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { useTranslation } from 'react-i18next';
import { getUserSessions, createSession, deleteSession, updateSession, removeSharing } from '../../lib/firestore';
import type { SessionDoc, SessionRole } from '../../types';
import SessionCard from './SessionCard';
import CreateSessionModal from './CreateSessionModal';
import ShareSessionModal from './ShareSessionModal';
import LanguageSwitcher from '../LanguageSwitcher';

export default function SessionList() {
  const { user, isGuest, logout, appRole } = useAuth();
  const { settings: globalSettings } = useGlobalSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Array<{ id: string } & SessionDoc>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [shareSessionId, setShareSessionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserSessions(user.uid, user.email ?? `guest-${user.uid}@anonymous`);
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreate = async (name: string, description: string) => {
    if (!user) return;
    const id = await createSession(user.uid, user.email ?? `guest-${user.uid}@anonymous`, name, description);
    setShowCreate(false);
    navigate(`/sessions/${id}/dashboard`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette session ? Cette action est irréversible.')) return;
    await deleteSession(id);
    await loadSessions();
  };

  const handleRename = async (id: string, name: string) => {
    await updateSession(id, { name });
    await loadSessions();
  };

  const handleLeave = async (id: string) => {
    if (!user) return;
    if (!confirm('Quitter cette session partagée ?')) return;
    await removeSharing(id, user.uid, user.email ?? `guest-${user.uid}@anonymous`);
    await loadSessions();
  };

  const getUserRole = (session: { id: string } & SessionDoc): SessionRole => {
    if (!user) return 'reader';
    return session.members[user.uid] ?? 'reader';
  };

  return (
    <div className="min-h-screen" style={{ background: '#f9f9fd' }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: '#e6e7ef' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {globalSettings.logo ? (
              <img 
                src={globalSettings.logo} 
                alt="Logo" 
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="p-2 rounded-lg" style={{ background: '#f0f0ff' }}>
                <BookOpen className="w-5 h-5" style={{ color: '#5556fd' }} />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#06072d' }}>{t('app.name')}</h1>
              <p className="text-xs" style={{ color: '#8392a5' }}>{t('app.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {appRole === 'admin' && (
              <Link to="/admin" className="text-sm px-3 py-1.5 rounded hover:bg-[#f0f0ff] transition-colors" style={{ color: '#5556fd' }}>
                {t('navigation.admin')}
              </Link>
            )}
            <span className="text-sm" style={{ color: '#575d78' }}>{isGuest ? t('auth.guest') : (user?.displayName || user?.email)}</span>
            <button onClick={logout} className="p-2 rounded hover:bg-[#f9f9fd]" style={{ color: '#8392a5' }} title={t('auth.logout')}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {isGuest && (
          <div className="mb-6 p-4 rounded flex items-center gap-3 text-sm" style={{ background: '#fff8e1', border: '1px solid #ffc107', color: '#b86e1d' }}>
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{t('sessions.guest.warning')}</p>
              <p className="text-xs mt-0.5" style={{ color: '#c07a2a' }}>{t('sessions.guest.message')}</p>
            </div>
            <Link to="/register" className="font-semibold text-xs px-4 py-2 rounded text-white shrink-0" style={{ background: '#5556fd' }}>
              {t('sessions.guest.createAccount')}
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: '#06072d' }}>Mes sessions</h2>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: '#5556fd' }}>
            <Plus className="w-4 h-4" /> Nouvelle session
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#8392a5' }}>Chargement...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-full mb-4" style={{ background: '#f0f0ff' }}>
              <BookOpen className="w-8 h-8" style={{ color: '#5556fd' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#06072d' }}>Aucune session</h3>
            <p className="text-sm mb-6" style={{ color: '#8392a5' }}>Créez votre première session pour commencer</p>
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded text-sm font-semibold text-white"
              style={{ background: '#5556fd' }}>
              Créer une session
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                userRole={getUserRole(s)}
                onClick={() => navigate(`/sessions/${s.id}/dashboard`)}
                onRename={(name) => handleRename(s.id, name)}
                onDelete={() => handleDelete(s.id)}
                onShare={() => setShareSessionId(s.id)}
                onLeave={() => handleLeave(s.id)}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateSessionModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      {shareSessionId && (
        <ShareSessionModal sessionId={shareSessionId} onClose={() => setShareSessionId(null)} />
      )}
    </div>
  );
}
