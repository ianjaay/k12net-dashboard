import { useSession } from '../../contexts/SessionContext';
import Dashboard from '../Dashboard';
import { useNavigate } from 'react-router-dom';
import type { Student } from '../../types';

export default function DashboardRoute() {
  const { activeData, sessionId } = useSession();
  const navigate = useNavigate();

  if (!activeData?.students) return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;

  const handleStudentClick = (s: Student) => {
    navigate(`/sessions/${sessionId}/students/${encodeURIComponent(s.matricule)}`);
  };

  return (
    <Dashboard
      data={activeData}
      onStudentClick={handleStudentClick}
    />
  );
}
