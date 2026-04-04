import { useSession } from '../../contexts/SessionContext';
import StudentList from '../StudentList';
import { useNavigate } from 'react-router-dom';
import type { K12Student } from '../../types/k12';

export default function StudentsRoute() {
  const { activeStudents, sessionId, termView, setTermView } = useSession();
  const navigate = useNavigate();

  if (activeStudents.length === 0) return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;

  const handleStudentClick = (s: K12Student) => {
    navigate(`/sessions/${sessionId}/students/${encodeURIComponent(s.matricule)}`);
  };

  return (
    <StudentList
      students={activeStudents}
      termView={termView}
      onTermViewChange={setTermView}
      onStudentClick={handleStudentClick}
    />
  );
}
