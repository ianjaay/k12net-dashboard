import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEstablishment } from '../../contexts/EstablishmentContext';
import { BookOpen, Clock } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, userStatus, isSuperAdmin, logout } = useAuth();
  const { needsSelection, loading: estLoading } = useEstablishment();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAnonymous && userStatus === 'suspended') return <Navigate to="/login" replace />;

  if (!user.isAnonymous && userStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f9f9fd' }}>
        <div className="w-full max-w-md text-center">
          <div className="inline-flex p-3 rounded-lg mb-4" style={{ background: '#fff8e1' }}>
            <Clock className="w-8 h-8" style={{ color: '#d4a017' }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#06072d' }}>Compte en attente d'activation</h1>
          <p className="text-sm mb-6" style={{ color: '#8392a5' }}>
            Votre compte a bien été créé. Un administrateur doit valider votre accès avant que vous puissiez utiliser la plateforme.
          </p>
          <div className="card-cassie p-6 mb-4">
            <div className="flex items-center gap-3 justify-center">
              <BookOpen className="w-5 h-5" style={{ color: '#5556fd' }} />
              <span className="text-sm font-medium" style={{ color: '#575d78' }}>{user.displayName || user.email}</span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="text-sm font-medium transition-colors"
            style={{ color: '#5556fd' }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // Show loading while establishments are being loaded
  if (estLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f9fd' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8392a5' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  // Redirect to establishment selector if needed
  // Super-admins bypass this — they can access /super-admin without selecting an establishment
  const exemptPaths = ['/select-establishment', '/super-admin'];
  if (needsSelection && !isSuperAdmin && !exemptPaths.includes(location.pathname)) {
    return <Navigate to="/select-establishment" replace />;
  }

  return <Outlet />;
}
