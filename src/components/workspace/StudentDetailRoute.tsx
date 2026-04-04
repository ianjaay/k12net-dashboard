import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useStudentPhotos } from '../../contexts/StudentPhotosContext';
import StudentDetail from '../StudentDetail';

export default function StudentDetailRoute() {
  const { matricule } = useParams<{ matricule: string }>();
  const { activeStudents, sessionId } = useSession();
  const navigate = useNavigate();
  const { getPhoto } = useStudentPhotos();

  const decodedMatricule = matricule ? decodeURIComponent(matricule) : '';
  const student = activeStudents.find(s => s.matricule === decodedMatricule);

  if (!student) {
    return (
      <div className="text-center py-10">
        <p className="text-sm" style={{ color: '#8392a5' }}>Élève non trouvé</p>
        <button onClick={() => navigate(`/sessions/${sessionId}/students`)}
          className="text-sm mt-2 font-medium" style={{ color: '#5556fd' }}>
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <StudentDetail
      student={student}
      classStudents={activeStudents}
      onBack={() => navigate(`/sessions/${sessionId}/students`)}
      photoUrl={getPhoto(decodedMatricule)}
    />
  );
}
