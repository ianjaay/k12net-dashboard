import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { loadGlobalSettings, saveGlobalSettings } from '../lib/firestore';
import type { CourseStructure, ValidationRules } from '../types';

export interface GlobalAppSettings {
  logo?: string;
  schoolName?: string;
  sessionTitle?: string;
  sessionDate?: string;
  courses?: CourseStructure;
  validationRules?: ValidationRules;
}

interface GlobalSettingsContextType {
  settings: GlobalAppSettings;
  updateSettings: (settings: GlobalAppSettings) => void;
  loading: boolean;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'emsp-global-settings';

export function GlobalSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GlobalAppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(true);

  // Load from Firestore on mount
  useEffect(() => {
    loadGlobalSettings().then(remote => {
      if (remote) {
        setSettings(prev => ({ ...prev, ...remote }));
      }
    }).catch(() => {/* Firestore unavailable, use localStorage */}).finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback((newSettings: GlobalAppSettings) => {
    setSettings(newSettings);
    // Persist to Firestore (fire-and-forget)
    saveGlobalSettings(newSettings).catch(err =>
      console.warn('Failed to save global settings to Firestore:', err)
    );
  }, []);

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