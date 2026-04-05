/**
 * Step3_SessionSelection — Select academic years to import.
 * Shows API years + allows adding custom years.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Calendar, Plus } from 'lucide-react';
import type { SessionSelection } from '../../../../types/oneRoster';
import type { OneRosterService } from '../../../../lib/oneRosterService';
import { buildSessionSelections } from '../../../../lib/oneRosterService';

export interface SelectedYear {
  id: string;
  title: string;
}

interface Props {
  service: OneRosterService;
  onNext: (selectedYears: SelectedYear[]) => void;
  onBack: () => void;
}

/** Generate a range of school years like "2020-2021", "2021-2022", ... */
function generateYearOptions(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current - 5; y <= current + 1; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

export default function Step3_SessionSelection({ service, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiSessions, setApiSessions] = useState<SessionSelection[]>([]);
  const [customYears, setCustomYears] = useState<{ id: string; title: string; selected: boolean }[]>([]);
  const [showAddYear, setShowAddYear] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const allSessions = await service.getAcademicSessions();
        const selections = buildSessionSelections(allSessions);
        if (selections.length > 0) selections[0].selected = true;
        setApiSessions(selections);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [service]);

  const apiYearTitles = new Set(apiSessions.map(s => s.session.title));

  const toggleApiSession = useCallback((id: string) => {
    setApiSessions(prev =>
      prev.map(s => s.session.sourcedId === id ? { ...s, selected: !s.selected } : s),
    );
  }, []);

  const toggleCustomYear = useCallback((id: string) => {
    setCustomYears(prev =>
      prev.map(y => y.id === id ? { ...y, selected: !y.selected } : y),
    );
  }, []);

  const addCustomYear = useCallback((title: string) => {
    if (apiYearTitles.has(title) || customYears.some(y => y.title === title)) return;
    setCustomYears(prev => [...prev, { id: `custom_${title}`, title, selected: true }]);
    setShowAddYear(false);
  }, [apiYearTitles, customYears]);

  const removeCustomYear = useCallback((id: string) => {
    setCustomYears(prev => prev.filter(y => y.id !== id));
  }, []);

  const allSelected: SelectedYear[] = [
    ...apiSessions.filter(s => s.selected).map(s => ({ id: s.session.sourcedId, title: s.session.title })),
    ...customYears.filter(y => y.selected).map(y => ({ id: y.id, title: y.title })),
  ];

  // Available years to add (not already in API or custom)
  const availableToAdd = generateYearOptions().filter(
    y => !apiYearTitles.has(y) && !customYears.some(c => c.title === y),
  );

  if (loading) {
    return (
      <div className="card-cassie p-6 flex items-center justify-center gap-2" style={{ color: '#8392a5' }}>
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement des sessions académiques...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-cassie p-6 text-sm" style={{ color: '#ff4d4f' }}>
        Erreur : {error}
        <button onClick={onBack} className="ml-4 underline text-xs" style={{ color: '#8392a5' }}>
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="card-cassie p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5" style={{ color: '#5556fd' }} />
        <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
          Sélection des années scolaires
        </h3>
      </div>

      <p className="text-xs" style={{ color: '#8392a5' }}>
        Sélectionnez les années scolaires à importer. L'import sera effectué pour chaque année cochée.
      </p>

      <div className="space-y-2">
        {/* API sessions */}
        {apiSessions.map(s => (
          <label
            key={s.session.sourcedId}
            className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
            style={{ borderColor: s.selected ? '#5556fd' : '#e2e8f0' }}
          >
            <input
              type="checkbox"
              checked={s.selected}
              onChange={() => toggleApiSession(s.session.sourcedId)}
              className="mt-0.5 accent-[#5556fd]"
            />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: '#06072d' }}>
                {s.session.title}
                {s.session.status === 'active' && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: '#e6f9ef', color: '#1a8a4d' }}>
                    en cours
                  </span>
                )}
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: '#eef2ff', color: '#5556fd' }}>
                  API
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#8392a5' }}>
                {s.session.startDate} → {s.session.endDate}
              </div>
              {s.trimestres.length > 0 && (
                <div className="text-[10px] mt-1" style={{ color: '#8392a5' }}>
                  Trimestres : {s.trimestres.map(t => t.title).join(', ')}
                </div>
              )}
            </div>
          </label>
        ))}

        {/* Custom years */}
        {customYears.map(y => (
          <label
            key={y.id}
            className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
            style={{ borderColor: y.selected ? '#5556fd' : '#e2e8f0' }}
          >
            <input
              type="checkbox"
              checked={y.selected}
              onChange={() => toggleCustomYear(y.id)}
              className="mt-0.5 accent-[#5556fd]"
            />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: '#06072d' }}>
                {y.title}
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: '#fff3e6', color: '#d97706' }}>
                  ajoutée
                </span>
              </div>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); removeCustomYear(y.id); }}
              className="text-xs px-2 py-1 rounded hover:bg-red-50"
              style={{ color: '#ff4d4f' }}
            >
              ✕
            </button>
          </label>
        ))}

        {apiSessions.length === 0 && customYears.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: '#8392a5' }}>
            Aucune session académique trouvée. Ajoutez des années manuellement.
          </p>
        )}
      </div>

      {/* Add custom year */}
      {!showAddYear ? (
        <button
          onClick={() => setShowAddYear(true)}
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: '#5556fd' }}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter une année scolaire
        </button>
      ) : (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg border" style={{ borderColor: '#e2e8f0' }}>
          <span className="text-xs self-center" style={{ color: '#8392a5' }}>Ajouter :</span>
          {availableToAdd.map(y => (
            <button
              key={y}
              onClick={() => addCustomYear(y)}
              className="px-3 py-1 text-xs rounded-full border hover:bg-gray-50"
              style={{ borderColor: '#e2e8f0', color: '#06072d' }}
            >
              {y}
            </button>
          ))}
          {availableToAdd.length === 0 && (
            <span className="text-xs" style={{ color: '#8392a5' }}>Toutes les années sont déjà ajoutées</span>
          )}
          <button
            onClick={() => setShowAddYear(false)}
            className="text-xs px-2 py-1 ml-auto"
            style={{ color: '#8392a5' }}
          >
            Fermer
          </button>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg" style={{ color: '#8392a5' }}>
          ← Retour
        </button>
        <button
          onClick={() => onNext(allSelected)}
          disabled={allSelected.length === 0}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5556fd' }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
