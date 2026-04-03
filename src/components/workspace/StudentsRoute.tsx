import { useSession } from '../../contexts/SessionContext';
import StudentList from '../StudentList';
import { useNavigate } from 'react-router-dom';
import type { Student } from '../../types';

export default function StudentsRoute() {
  const { activeData, sessionId, hasBothSemesters, semesterView, setSemesterView } = useSession();
  const navigate = useNavigate();

  if (!activeData?.students) return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;

  const handleStudentClick = (s: Student) => {
    navigate(`/sessions/${sessionId}/students/${encodeURIComponent(s.matricule)}`);
  };

  return (
    <StudentList
      students={activeData.students}
      onStudentClick={handleStudentClick}
      hasBothSemesters={hasBothSemesters}
      semesterView={semesterView}
      onSemesterViewChange={setSemesterView}
    />
  );
}
