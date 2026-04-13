import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { loadGlobalSettings, saveGlobalSettings } from '../lib/firestore';
import { updateEstablishment } from '../lib/firestoreEstablishments';
import { useEstablishment } from './EstablishmentContext';
import type { CourseDefinition, K12YearRulesConfig, AcademicYear } from '../types/k12';

export interface GlobalAppSettings {
  logo?: string;
  schoolName?: string;
  academicYear?: AcademicYear;
  /** Course catalog from K12net section list import */
  courseCatalog?: CourseDefinition[];
  /** Active rules config (selected year) */
  rulesConfig?: K12YearRulesConfig;
  /** All available year rule configs */
  yearConfigs?: Record<AcademicYear, K12YearRulesConfig>;
  /** Base URL for student photo web service, e.g. https://agfne.sigfne.net/vas/picture-noprod/ */
  photoBaseUrl?: string;
}

interface GlobalSettingsContextType {
  settings: GlobalAppSettings;
  updateSettings: (settings: GlobalAppSettings) => void;
  loading: boolean;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'k12net-global-settings';

export function GlobalSettingsProvider({ children }: { children: ReactNode }) {
  const { currentEstablishment } = useEstablishment();

  const [settings, setSettings] = useState<GlobalAppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(true);

  // Load settings: from establishment if available, else from globalSettings/default
  useEffect(() => {
    if (currentEstablishment) {
      // Load from establishment document
      const estSettings: GlobalAppSettings = {
        logo: currentEstablishment.logo,
        schoolName: currentEstablishment.schoolName || currentEstablishment.name,
        academicYear: currentEstablishment.academicYear,
        courseCatalog: currentEstablishment.courseCatalog,
        rulesConfig: currentEstablishment.rulesConfig,
        yearConfigs: currentEstablishment.yearConfigs,
        photoBaseUrl: currentEstablishment.photoBaseUrl,
      };
      setSettings(estSettings);
      setLoading(false);
    } else {
      // Fallback to globalSettings/default for backward compatibility
      loadGlobalSettings().then(remote => {
        if (remote) {
          setSettings(prev => ({ ...prev, ...remote }));
        }
      }).catch(() => {/* Firestore unavailable, use localStorage */}).finally(() => setLoading(false));
    }
  }, [currentEstablishment]);

  const updateSettings = useCallback((newSettings: GlobalAppSettings) => {
    setSettings(newSettings);

    if (currentEstablishment) {
      // Save to establishment document
      updateEstablishment(currentEstablishment.id, {
        logo: newSettings.logo,
        schoolName: newSettings.schoolName,
        academicYear: newSettings.academicYear,
        courseCatalog: newSettings.courseCatalog,
        rulesConfig: newSettings.rulesConfig,
        yearConfigs: newSettings.yearConfigs,
        photoBaseUrl: newSettings.photoBaseUrl,
      }).catch(err =>
        console.warn('Failed to save settings to establishment:', err)
      );
    } else {
      // Fallback: save to globalSettings/default
      saveGlobalSettings(newSettings).catch(err =>
        console.warn('Failed to save global settings to Firestore:', err)
      );
    }
  }, [currentEstablishment]);

  // Persist to localStorage whenever settings change (offline cache)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save global settings to localStorage:', error);
    }
  }, [settings]);

  return (
    <GlobalSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </GlobalSettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  const context = useContext(GlobalSettingsContext);
  if (context === undefined) {
    throw new Error('useGlobalSettings must be used within a GlobalSettingsProvider');
  }
  return context;
}