import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { extractMatriculeFromFilename } from '../utils/photos';
import { useGlobalSettings } from './GlobalSettingsContext';

// photos stored as: matricule (uppercase) → data URL string
export type PhotoMap = Record<string, string>;

interface StudentPhotosContextType {
  photos: PhotoMap;
  setPhotos: (photos: PhotoMap) => void;
  getPhoto: (matricule: string) => string | undefined;
  photoCount: number;
}

const STORAGE_KEY = 'emsp-student-photos';

const StudentPhotosContext = createContext<StudentPhotosContextType | undefined>(undefined);

export function StudentPhotosProvider({ children }: { children: ReactNode }) {
  const { settings } = useGlobalSettings();
  const photoBaseUrl = settings.photoBaseUrl;

  const [photos, setPhotosState] = useState<PhotoMap>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const setPhotos = useCallback((newPhotos: PhotoMap) => {
    setPhotosState(newPhotos);
  }, []);

  // Persist to localStorage whenever photos change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    } catch (error) {
      console.warn('Failed to save student photos to localStorage:', error);
    }
  }, [photos]);

  const getPhoto = useCallback(
    (matricule: string) => {
      const normalized = matricule.toUpperCase();

      // 1. Check local photos first
      if (photos[normalized]) return photos[normalized];

      const matchingKey = Object.keys(photos).find((key) => {
        const normalizedKey = key.toUpperCase();
        if (normalizedKey === normalized) return true;
        if (normalizedKey.startsWith(`${normalized}_`) || normalizedKey.startsWith(`${normalized}-`)) return true;
        return extractMatriculeFromFilename(key) === normalized;
      });
      if (matchingKey) return photos[matchingKey];

      // 2. If photoBaseUrl is configured, return the web service URL directly
      if (photoBaseUrl) {
        const baseUrl = photoBaseUrl.endsWith('/') ? photoBaseUrl : `${photoBaseUrl}/`;
        return `${baseUrl}${encodeURIComponent(matricule)}`;
      }

      return undefined;
    },
    [photos, photoBaseUrl],
  );

  return (
    <StudentPhotosContext.Provider value={{ photos, setPhotos, getPhoto, photoCount: Object.keys(photos).length }}>
      {children}
    </StudentPhotosContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudentPhotos() {
  const ctx = useContext(StudentPhotosContext);
  if (!ctx) throw new Error('useStudentPhotos must be used within StudentPhotosProvider');
  return ctx;
}
