import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import Deliberation from '../Deliberation';
import type { K12Student } from '../../types/k12';

export default function DeliberationRoute() {
  const { activeStudents, sessionId, termView, setTermView, appData } = useSession();
  const navigate = useNavigate();

  if (activeStudents.length === 0) return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;

  const handleStudentClick = (s: K12Student) => {
    navigate(`/sessions/${sessionId}/students/${encodeURIComponent(s.matricule)}`);
  };

  return (
    <Deliberation
      students={activeStudents}
      termView={termView}
      onTermViewChange={setTermView}
      onStudentClick={handleStudentClick}
      schoolName={appData?.schoolName}
    />
  );
}
