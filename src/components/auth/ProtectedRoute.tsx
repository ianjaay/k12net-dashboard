import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute() {
  const { user, userStatus } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAnonymous && userStatus === 'suspended') return <Navigate to="/login" replace />;
  return <Outlet />;
}
