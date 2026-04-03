import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { BookOpen, UserCircle, Play } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loginGoogle, loginMicrosoft, loginGuest, loginDemo } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/sessions" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.login.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await provider();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f9f9fd' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-lg mb-3" style={{ background: '#f0f0ff' }}>
            <BookOpen className="w-8 h-8" style={{ color: '#5556fd' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#06072d' }}>{t('app.name')}</h1>
          <p className="text-sm mt-1" style={{ color: '#8392a5' }}>{t('app.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="card-cassie p-8">
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#06072d' }}>{t('auth.login.title')}</h2>

          {error && (
            <div className="mb-4 p-3 rounded text-sm" style={{ background: '#fce8ea', color: '#dc3545' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#575d78' }}>{t('auth.login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded border text-sm outline-none transition-colors"
                style={{ borderColor: '#e6e7ef', color: '#06072d' }}
                onFocus={e => e.target.style.borderColor = '#5556fd'}
                onBlur={e => e.target.style.borderColor = '#e6e7ef'}
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#575d78' }}>{t('auth.login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded border text-sm outline-none transition-colors"
                style={{ borderColor: '#e6e7ef', color: '#06072d' }}
                onFocus={e => e.target.style.borderColor = '#5556fd'}
                onBlur={e => e.target.style.borderColor = '#e6e7ef'}
                placeholder="********"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#5556fd' }}
            >
              {loading ? t('auth.login.loading') : t('auth.login.submit')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: '#e6e7ef' }} />
            <span className="text-xs" style={{ color: '#8392a5' }}>{t('auth.login.or')}</span>
            <div className="flex-1 h-px" style={{ background: '#e6e7ef' }} />
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth(loginGoogle)}
              disabled={loading}
              className="w-full py-2.5 rounded border text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ borderColor: '#e6e7ef', color: '#575d78' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuer avec Google
            </button>
            <button
              onClick={() => handleOAuth(loginMicrosoft)}
              disabled={loading}
              className="w-full py-2.5 rounded border text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ borderColor: '#e6e7ef', color: '#575d78' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
              Continuer avec Microsoft
            </button>
          </div>

          {/* Divider 2 */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: '#e6e7ef' }} />
            <span className="text-xs" style={{ color: '#8392a5' }}>{t('auth.login.quickAccess')}</span>
            <div className="flex-1 h-px" style={{ background: '#e6e7ef' }} />
          </div>

          {/* Guest & Demo buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth(loginGuest)}
              disabled={loading}
              className="w-full py-2.5 rounded border-2 border-dashed text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ borderColor: '#c0ccda', color: '#575d78', background: '#f9f9fd' }}
            >
              <UserCircle className="w-4 h-4" />
              {t('auth.login.guest')}
            </button>
            <button
              onClick={() => handleOAuth(loginDemo)}
              disabled={loading}
              className="w-full py-2.5 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#4bdedb', color: '#1e1a70' }}
            >
              <Play className="w-4 h-4" />
              {t('auth.login.demo')}
            </button>
          </div>

          {/* Info texts */}
          <div className="mt-4 space-y-1">
            <p className="text-[10px] text-center" style={{ color: '#c0ccda' }}>
              Invité : données locales uniquement, non sauvegardées sur le cloud
            </p>
            <p className="text-[10px] text-center" style={{ color: '#c0ccda' }}>
              Démo : compte partagé avec des données d'exemple pré-chargées
            </p>
          </div>

          {/* Register link */}
          <p className="text-center text-sm mt-6" style={{ color: '#8392a5' }}>
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="font-medium" style={{ color: '#5556fd' }}>
              {t('auth.login.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
