/**
 * MultiLevelPage — Main container for multi-level navigation.
 *
 * Renders the appropriate dashboard based on the current navigation level,
 * along with breadcrumb, year selector, and tab navigation.
 */
import { useState, useEffect } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { seedDRENAs } from '../../lib/educationDB';
import Breadcrumb from './Breadcrumb';
import MinistereDashboard from './MinistereDashboard';
import DRENADashboard from './DRENADashboard';
import EtablissementDashboard from './EtablissementDashboard';
import ClasseDashboard from './ClasseDashboard';
import ImportWizard from './ImportWizard';

type Tab = 'overview' | 'admin';

export default function MultiLevelPage() {
  const { state } = useNavigation();
  const [tab, setTab] = useState<Tab>('overview');

  // Seed DRENAs on first load
  useEffect(() => { seedDRENAs(); }, []);

  // Tabs change based on level
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'admin', label: 'Administration' },
  ];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: '#e6e7ef' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-xs font-medium transition-colors relative"
            style={{
              color: tab === t.key ? '#5556fd' : '#8392a5',
              borderBottom: tab === t.key ? '2px solid #5556fd' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <>
          {state.level === 'ministere' && <MinistereDashboard />}
          {state.level === 'drena' && <DRENADashboard />}
          {state.level === 'etablissement' && <EtablissementDashboard />}
          {state.level === 'classe' && <ClasseDashboard />}
        </>
      )}

      {tab === 'admin' && <ImportWizard />}
    </div>
  );
}
