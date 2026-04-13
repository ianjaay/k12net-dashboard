import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EstablishmentSelector from './components/establishments/EstablishmentSelector';
import SessionList from './components/sessions/SessionList';
import SessionWorkspace from './components/workspace/SessionWorkspace';
import DashboardRoute from './components/workspace/DashboardRoute';
import StudentsRoute from './components/workspace/StudentsRoute';
import StudentDetailRoute from './components/workspace/StudentDetailRoute';
import DeliberationRoute from './components/workspace/DeliberationRoute';
import AdminRoute from './components/workspace/AdminRoute';
import GlobalAdminPage from './components/workspace/GlobalAdminPage';
import ReportsRoute from './components/workspace/ReportsRoute';
import VersionHistory from './components/workspace/VersionHistory';
import MultiLevelRoute from './components/multilevel/MultiLevelRoute';
import { lazy, Suspense } from 'react';

const SuperAdmin = lazy(() => import('./components/SuperAdmin'));

function SuperAdminRoute() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f9fd' }}>
        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
      </div>
    }>
      <SuperAdmin />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/select-establishment', element: <EstablishmentSelector /> },
      { path: '/super-admin', element: <SuperAdminRoute /> },
      { path: '/admin', element: <GlobalAdminPage /> },
      { path: '/multilevel', element: <MultiLevelRoute /> },
      { path: '/sessions', element: <SessionList /> },
      {
        path: '/sessions/:id',
        element: <SessionWorkspace />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardRoute /> },
          { path: 'students', element: <StudentsRoute /> },
          { path: 'students/:matricule', element: <StudentDetailRoute /> },
          { path: 'deliberation', element: <DeliberationRoute /> },
          { path: 'reports', element: <ReportsRoute /> },
          { path: 'admin', element: <AdminRoute /> },
          { path: 'history', element: <VersionHistory /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/sessions" replace /> },
]);
