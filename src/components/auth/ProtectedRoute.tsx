import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Clock } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, userStatus, logout } = useAuth();
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

  return <Outlet />;
}
