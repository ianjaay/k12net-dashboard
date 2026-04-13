import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  listUserEstablishments,
  listAllEstablishments,
  getEstablishment,
} from '../lib/firestoreEstablishments';
import type { Establishment } from '../types/establishment';

interface EstablishmentContextType {
  currentEstablishment: Establishment | null;
  userEstablishments: Establishment[];
  loading: boolean;
  /** true when user needs to pick an establishment (multi-establishment user, none selected) */
  needsSelection: boolean;
  switchEstablishment: (establishmentId: string) => Promise<void>;
  refreshEstablishments: () => Promise<void>;
}

const EstablishmentContext = createContext<EstablishmentContextType | undefined>(undefined);

const STORAGE_KEY = 'k12net-current-establishment';

export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, userEstablishmentIds, currentEstablishmentId } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [currentEstablishment, setCurrentEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEstablishments = useCallback(async () => {
    if (!user) {
      setEstablishments([]);
      setCurrentEstablishment(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let list: Establishment[];

      if (isSuperAdmin) {
        list = await listAllEstablishments();
      } else {
        list = await listUserEstablishments(user.uid);
      }

      setEstablishments(list);

      // Determine current establishment
      const savedId = localStorage.getItem(STORAGE_KEY) || currentEstablishmentId;
      if (savedId) {
        const saved = list.find(e => e.id === savedId);
        if (saved) {
          setCurrentEstablishment(saved);
        } else if (list.length === 1) {
          setCurrentEstablishment(list[0]);
          localStorage.setItem(STORAGE_KEY, list[0].id);
        } else {
          setCurrentEstablishment(null);
        }
      } else if (list.length === 1) {
        setCurrentEstablishment(list[0]);
        localStorage.setItem(STORAGE_KEY, list[0].id);
      } else {
        setCurrentEstablishment(null);
      }
    } catch (err) {
      console.error('Failed to load establishments:', err);
      setEstablishments([]);
      setCurrentEstablishment(null);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin, userEstablishmentIds, currentEstablishmentId]);

  useEffect(() => {
    void loadEstablishments();
  }, [loadEstablishments]);

  const switchEstablishment = useCallback(async (establishmentId: string) => {
    const est = establishments.find(e => e.id === establishmentId)
      ?? await getEstablishment(establishmentId);

    if (!est) throw new Error('Établissement introuvable');

    setCurrentEstablishment(est);
    localStorage.setItem(STORAGE_KEY, establishmentId);

    // Persist to user profile
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          currentEstablishment: establishmentId,
        });
      } catch {
        // Non-critical: localStorage already has the value
      }
    }
  }, [user, establishments]);

  const needsSelection = !loading && establishments.length > 0 && !currentEstablishment;

  return (
    <EstablishmentContext.Provider value={{
      currentEstablishment,
      userEstablishments: establishments,
      loading,
      needsSelection,
      switchEstablishment,
      refreshEstablishments: loadEstablishments,
    }}>
      {children}
    </EstablishmentContext.Provider>
  );
}

export function useEstablishment() {
  const ctx = useContext(EstablishmentContext);
  if (!ctx) throw new Error('useEstablishment must be used within EstablishmentProvider');
  return ctx;
}
