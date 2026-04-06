import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useStudentPhotos } from '../../contexts/StudentPhotosContext';
import StudentDetail from '../StudentDetail';

export default function StudentDetailRoute() {
  const { matricule } = useParams<{ matricule: string }>();
  const { activeStudents, sessionId, filteredStudentMatricules } = useSession();
  const navigate = useNavigate();
  const { getPhoto } = useStudentPhotos();

  const decodedMatricule = matricule ? decodeURIComponent(matricule) : '';
  const student = activeStudents.find(s => s.matricule === decodedMatricule);

  // Use the filtered list if available, otherwise fall back to all active students
  const navList = useMemo(() => {
    if (filteredStudentMatricules.length > 0) return filteredStudentMatricules;
    return activeStudents.map(s => s.matricule);
  }, [filteredStudentMatricules, activeStudents]);

  const currentIndex = navList.indexOf(decodedMatricule);
  const prevMatricule = currentIndex > 0 ? navList[currentIndex - 1] : null;
  const nextMatricule = currentIndex >= 0 && currentIndex < navList.length - 1 ? navList[currentIndex + 1] : null;

  const goBack = useCallback(() => {
    navigate(`/sessions/${sessionId}/students`);
  }, [navigate, sessionId]);

  const goPrev = useCallback(() => {
    if (prevMatricule) navigate(`/sessions/${sessionId}/students/${encodeURIComponent(prevMatricule)}`);
  }, [navigate, sessionId, prevMatricule]);

  const goNext = useCallback(() => {
    if (nextMatricule) navigate(`/sessions/${sessionId}/students/${encodeURIComponent(nextMatricule)}`);
  }, [navigate, sessionId, nextMatricule]);

  if (!student) {
    return (
      <div className="text-center py-10">
        <p className="text-sm" style={{ color: '#8392a5' }}>Élève non trouvé</p>
        <button onClick={goBack}
          className="text-sm mt-2 font-medium" style={{ color: '#5556fd' }}>
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <StudentDetail
      key={decodedMatricule}
      student={student}
      classStudents={activeStudents}
      onBack={goBack}
      onPrev={prevMatricule ? goPrev : undefined}
      onNext={nextMatricule ? goNext : undefined}
      currentIndex={currentIndex}
      totalFiltered={navList.length}
      photoUrl={getPhoto(decodedMatricule)}
    />
  );
}
