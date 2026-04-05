/**
 * NavigationContext — Multi-level navigation state.
 *
 * Tracks the current position in the hierarchy:
 *   Ministère → DRENA → Établissement → Classe
 *
 * Provides:
 *   - Current navigation level and selected entities
 *   - Breadcrumb data
 *   - Navigation functions (drillDown, goBack, goToLevel)
 */
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { NavigationLevel, NavigationState, DRENA, Etablissement, ClasseML } from '../types/multiLevel';
import { MINISTERE_DEFAULT } from '../types/multiLevel';
import { getDRENA, getEtablissement, getClasse } from '../lib/educationDB';

export interface BreadcrumbItem {
  label: string;
  level: NavigationLevel;
  id?: string;
}

interface NavigationContextType {
  state: NavigationState;
  breadcrumbs: BreadcrumbItem[];
  anneeScolaire: string;
  setAnneeScolaire: (year: string) => void;
  goToMinistere: () => void;
  goToDRENA: (drena_id: string) => void;
  goToEtablissement: (etablissement_id: string) => void;
  goToClasse: (classe_id: string) => void;
  goToLevel: (level: NavigationLevel) => void;
  // Cached entities for current path
  currentDRENA: DRENA | null;
  currentEtablissement: Etablissement | null;
  currentClasse: ClasseML | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const STORAGE_KEY = 'k12net-navigation';

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { level: 'ministere', annee_scolaire: '2025' };
    } catch {
      return { level: 'ministere' as NavigationLevel, annee_scolaire: '2025' };
    }
  });

  const [anneeScolaire, setAnneeScolaireState] = useState(state.annee_scolaire ?? '2025');
  const [currentDRENA, setCurrentDRENA] = useState<DRENA | null>(null);
  const [currentEtablissement, setCurrentEtablissement] = useState<Etablissement | null>(null);
  const [currentClasse, setCurrentClasse] = useState<ClasseML | null>(null);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* noop */ }
  }, [state]);

  // Fetch cached entities when state changes
  useEffect(() => {
    if (state.drena_id) {
      getDRENA(state.drena_id).then(d => setCurrentDRENA(d ?? null));
    } else {
      setCurrentDRENA(null);
    }
  }, [state.drena_id]);

  useEffect(() => {
    if (state.etablissement_id) {
      getEtablissement(state.etablissement_id).then(e => setCurrentEtablissement(e ?? null));
    } else {
      setCurrentEtablissement(null);
    }
  }, [state.etablissement_id]);

  useEffect(() => {
    if (state.classe_id) {
      getClasse(state.classe_id).then(c => setCurrentClasse(c ?? null));
    } else {
      setCurrentClasse(null);
    }
  }, [state.classe_id]);

  const setAnneeScolaire = useCallback((year: string) => {
    setAnneeScolaireState(year);
    setState(prev => ({ ...prev, annee_scolaire: year }));
  }, []);

  const goToMinistere = useCallback(() => {
    setState({ level: 'ministere', annee_scolaire: anneeScolaire });
  }, [anneeScolaire]);

  const goToDRENA = useCallback((drena_id: string) => {
    setState(prev => ({
      ...prev,
      level: 'drena',
      drena_id,
      etablissement_id: undefined,
      classe_id: undefined,
    }));
  }, []);

  const goToEtablissement = useCallback((etablissement_id: string) => {
    setState(prev => ({
      ...prev,
      level: 'etablissement',
      etablissement_id,
      classe_id: undefined,
    }));
  }, []);

  const goToClasse = useCallback((classe_id: string) => {
    setState(prev => ({
      ...prev,
      level: 'classe',
      classe_id,
    }));
  }, []);

  const goToLevel = useCallback((level: NavigationLevel) => {
    setState(prev => {
      const newState: NavigationState = { level, annee_scolaire: prev.annee_scolaire };
      if (level === 'ministere') return newState;
      newState.drena_id = prev.drena_id;
      if (level === 'drena') return newState;
      newState.etablissement_id = prev.etablissement_id;
      if (level === 'etablissement') return newState;
      newState.classe_id = prev.classe_id;
      return newState;
    });
  }, []);

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [{ label: MINISTERE_DEFAULT.nom, level: 'ministere' }];

    if (state.level === 'ministere') return items;

    items.push({
      label: currentDRENA?.nom ?? state.drena_id ?? 'DRENA',
      level: 'drena',
      id: state.drena_id,
    });

    if (state.level === 'drena') return items;

    items.push({
      label: currentEtablissement?.nom ?? state.etablissement_id ?? 'Établissement',
      level: 'etablissement',
      id: state.etablissement_id,
    });

    if (state.level === 'etablissement') return items;

    items.push({
      label: currentClasse?.nom ?? state.classe_id ?? 'Classe',
      level: 'classe',
      id: state.classe_id,
    });

    return items;
  }, [state, currentDRENA, currentEtablissement, currentClasse]);

  return (
    <NavigationContext.Provider
      value={{
        state,
        breadcrumbs,
        anneeScolaire,
        setAnneeScolaire,
        goToMinistere,
        goToDRENA,
        goToEtablissement,
        goToClasse,
        goToLevel,
        currentDRENA,
        currentEtablissement,
        currentClasse,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
