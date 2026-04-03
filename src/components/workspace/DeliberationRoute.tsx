import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import Deliberation from '../Deliberation';
import type { Student } from '../../types';

export default function DeliberationRoute() {
  const { activeData, sessionId, hasBothSemesters, semesterView, setSemesterView } = useSession();
  const navigate = useNavigate();

  if (!activeData) return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;

  const handleStudentClick = (s: Student) => {
    navigate(`/sessions/${sessionId}/students/${encodeURIComponent(s.matricule)}`);
  };

  return (
    <Deliberation
      data={activeData}
      onStudentClick={handleStudentClick}
      hasBothSemesters={hasBothSemesters}
      semesterView={semesterView}
      onSemesterViewChange={setSemesterView}
    />
  );
}
