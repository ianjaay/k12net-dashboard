/**
 * Step1_AnneeSelection — Select or create the academic year.
 */
import { useState, useEffect } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { getAllAnneeScolaires, ensureDefaultYear } from '../../../../lib/educationDB';
import type { AnneeScolaire } from '../../../../types/multiLevel';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export default function Step1_AnneeSelection({ value, onChange, onNext }: Props) {
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newYear, setNewYear] = useState('');

  useEffect(() => {
    getAllAnneeScolaires().then(setAnnees);
  }, []);

  const handleCreate = async () => {
    const y = parseInt(newYear, 10);
    if (isNaN(y) || y < 2000 || y > 2100) return;
    await ensureDefaultYear(String(y));
    const refreshed = await getAllAnneeScolaires();
    setAnnees(refreshed);
    onChange(String(y));
    setShowCreate(false);
    setNewYear('');
  };

  // Generate year options if none exist
  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="card-cassie p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5" style={{ color: '#5556fd' }} />
        <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
          Année scolaire
        </h3>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
          Sélectionner l'année scolaire
        </label>
        <div className="flex gap-2">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
          >
            {annees.length === 0 && defaultYears.map(y => (
              <option key={y} value={String(y)}>
                {y}-{y + 1}
              </option>
            ))}
            {annees.map(a => (
              <option key={a.id} value={a.id}>
                {a.libelle} {a.active ? '(active)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border"
            style={{ borderColor: '#e2e8f0', color: '#5556fd' }}
          >
            <Plus className="w-4 h-4" /> Créer
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
              Année de début
            </label>
            <input
              type="number"
              value={newYear}
              onChange={e => setNewYear(e.target.value)}
              placeholder={String(currentYear)}
              min={2000}
              max={2100}
              className="px-3 py-2 text-sm rounded-lg border w-32"
              style={{ borderColor: '#e2e8f0' }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!newYear}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#5556fd' }}
          >
            Créer {newYear && `${newYear}-${parseInt(newYear, 10) + 1}`}
          </button>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={async () => {
            await ensureDefaultYear(value);
            onNext();
          }}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: '#5556fd' }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
