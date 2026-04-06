/**
 * Route wrapper for the multi-level pages.
 * Provides NavigationContext.
 */
import { NavigationProvider } from '../../contexts/NavigationContext';
import MultiLevelPage from './MultiLevelPage';

export default function MultiLevelRoute() {
  return (
    <NavigationProvider>
      <div className="min-h-screen" style={{ background: '#f4f5fa' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <MultiLevelPage />
        </div>
      </div>
    </NavigationProvider>
  );
}
