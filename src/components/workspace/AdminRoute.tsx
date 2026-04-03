import { Navigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import Admin from '../Admin';

export default function AdminRoute() {
  const { appData, userRole, sessionId, handleDataReady, handleCreditOverridesChange, handleTermConfigChange } = useSession();
  const { settings: globalSettings } = useGlobalSettings();

  if (userRole === 'reader') {
    return <Navigate to={`/sessions/${sessionId}/dashboard`} replace />;
  }

  if (!appData) return <p className="text-sm" style={{ color: '#8392a5' }}>Aucune donnée chargée</p>;

  return (
    <Admin
      data={appData}
      onDataReady={handleDataReady}
      onCreditOverridesChange={handleCreditOverridesChange}
      onTermConfigChange={handleTermConfigChange}
      globalCourses={globalSettings.courses}
      validationRules={globalSettings.validationRules}
    />
  );
}
