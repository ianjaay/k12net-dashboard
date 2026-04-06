import { useSession } from '../../contexts/SessionContext';
import ReportsTab from '../reports/ReportsTab';

export default function ReportsRoute() {
  const { activeStudents } = useSession();

  if (activeStudents.length === 0) {
    return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;
  }

  return <ReportsTab />;
}
