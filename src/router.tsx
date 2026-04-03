import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SessionList from './components/sessions/SessionList';
import SessionWorkspace from './components/workspace/SessionWorkspace';
import DashboardRoute from './components/workspace/DashboardRoute';
import StudentsRoute from './components/workspace/StudentsRoute';
import StudentDetailRoute from './components/workspace/StudentDetailRoute';
import DeliberationRoute from './components/workspace/DeliberationRoute';
import AdminRoute from './components/workspace/AdminRoute';
import GlobalAdminPage from './components/workspace/GlobalAdminPage';
import VersionHistory from './components/workspace/VersionHistory';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/admin', element: <GlobalAdminPage /> },
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
          { path: 'admin', element: <AdminRoute /> },
          { path: 'history', element: <VersionHistory /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/sessions" replace /> },
]);
