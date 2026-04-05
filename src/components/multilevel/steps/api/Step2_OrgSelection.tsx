/**
 * Step2_OrgSelection — Flat list with checkboxes for Établissements selection.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Building2, Search } from 'lucide-react';
import type { OrgSelectionTree } from '../../../../types/oneRoster';
import type { OneRosterService } from '../../../../lib/oneRosterService';
import { buildOrgTree } from '../../../../lib/oneRosterService';

interface Props {
  service: OneRosterService;
  onNext: (tree: OrgSelectionTree) => void;
  onBack: () => void;
}

export default function Step2_OrgSelection({ service, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<OrgSelectionTree | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const schools = await service.getSchools();
        const built = buildOrgTree(schools);
        setTree(built);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [service]);

  const toggleEtablissement = useCallback((id: string) => {
    setTree(prev => {
      if (!prev) return prev;
      return {
        etablissements: prev.etablissements.map(e =>
          e.org.sourcedId === id ? { ...e, selected: !e.selected } : e,
        ),
      };
    });
  }, []);

  const toggleAll = useCallback((select: boolean) => {
    setTree(prev => {
      if (!prev) return prev;
      return {
        etablissements: prev.etablissements.map(e => ({ ...e, selected: select })),
      };
    });
  }, []);

  if (loading) {
    return (
      <div className="card-cassie p-6 flex items-center justify-center gap-2" style={{ color: '#8392a5' }}>
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement des établissements...
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

  if (!tree) return null;

  const totalSelected = tree.etablissements.filter(e => e.selected).length;
  const filterLower = filter.toLowerCase();
  const visible = filter
    ? tree.etablissements.filter(e =>
        e.org.name.toLowerCase().includes(filterLower) ||
        (e.org.identifier ?? '').toLowerCase().includes(filterLower))
    : tree.etablissements;

  return (
    <div className="card-cassie p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
          Sélection des établissements
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => toggleAll(true)} className="underline" style={{ color: '#5556fd' }}>
            Tout sélectionner
          </button>
          <span style={{ color: '#c0ccda' }}>|</span>
          <button onClick={() => toggleAll(false)} className="underline" style={{ color: '#8392a5' }}>
            Tout désélectionner
          </button>
        </div>
      </div>

      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8392a5' }} />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Rechercher un établissement..."
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: '#e3ebf6', color: '#06072d' }}
        />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {visible.map(etab => (
          <div
            key={etab.org.sourcedId}
            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50"
          >
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={etab.selected}
                onChange={() => toggleEtablissement(etab.org.sourcedId)}
                className="accent-[#5556fd]"
              />
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5556fd' }} />
              <span className="text-sm" style={{ color: '#06072d' }}>
                {etab.org.name}
              </span>
              {etab.org.identifier && (
                <span className="text-[10px]" style={{ color: '#8392a5' }}>
                  ({etab.org.identifier})
                </span>
              )}
            </label>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-xs text-center py-4" style={{ color: '#8392a5' }}>
            Aucun établissement trouvé
          </div>
        )}
      </div>

      <div className="text-xs pt-2" style={{ color: '#8392a5' }}>
        Sélection : <strong>{totalSelected}</strong> / {tree.etablissements.length} établissements
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg" style={{ color: '#8392a5' }}>
          ← Retour
        </button>
        <button
          onClick={() => onNext(tree)}
          disabled={totalSelected === 0}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5556fd' }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
