/**
 * ClasseDashboard — Class-level overview.
 *
 * Shows: student list, demographics, gender/redoublant stats.
 */
import { useState, useEffect, useMemo } from 'react';
import { Users, UserCircle, Award, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import type { EleveML } from '../../types/multiLevel';
import { getElevesByClasse } from '../../lib/educationDB';
import { useNavigation } from '../../contexts/NavigationContext';

export default function ClasseDashboard() {
  const { state, currentClasse, goToLevel } = useNavigation();
  const [eleves, setEleves] = useState<EleveML[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<'nom' | 'prenom' | 'sexe' | 'qualite'>('nom');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!state.classe_id) return;
    getElevesByClasse(state.classe_id)
      .then(setEleves)
      .finally(() => setLoading(false));
  }, [state.classe_id]);

  const sorted = useMemo(() => {
    let list = [...eleves];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        e.matricule.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [eleves, sortKey, sortDir, search]);

  const stats = useMemo(() => ({
    total: eleves.length,
    garcons: eleves.filter(e => e.sexe === 'Masculin').length,
    filles: eleves.filter(e => e.sexe === 'Féminin').length,
    redoublants: eleves.filter(e => e.qualite === 'Redoublant').length,
  }), [eleves]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline" />
      : <ChevronDown className="w-3 h-3 inline" />;
  };

  if (loading) {
    return <div className="text-center py-10 text-sm" style={{ color: '#8392a5' }}>Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <button
          onClick={() => goToLevel('etablissement')}
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: '#5556fd' }}
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#06072d' }}>
            {currentClasse?.nom ?? 'Classe'}
          </h2>
          {currentClasse && (
            <p className="text-xs" style={{ color: '#8392a5' }}>
              {currentClasse.niveau}{currentClasse.serie ? ` — Série ${currentClasse.serie}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Effectif" value={stats.total} color="#5556fd" />
        <KPI label="Garçons" value={stats.garcons} color="#3b82f6" />
        <KPI label="Filles" value={stats.filles} color="#ec4899" />
        <KPI label="Redoublants" value={stats.redoublants} color="#f59e0b" />
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Rechercher un élève…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full sm:w-72 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
        style={{ borderColor: '#e6e7ef', color: '#373857' }}
      />

      {/* Student table */}
      {sorted.length > 0 ? (
        <div className="card-cassie overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold cursor-pointer select-none" style={{ color: '#8392a5' }} onClick={() => toggleSort('nom')}>
                  Nom <SortIcon col="nom" />
                </th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-semibold cursor-pointer select-none" style={{ color: '#8392a5' }} onClick={() => toggleSort('prenom')}>
                  Prénom <SortIcon col="prenom" />
                </th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Matricule</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold cursor-pointer select-none" style={{ color: '#8392a5' }} onClick={() => toggleSort('sexe')}>
                  Sexe <SortIcon col="sexe" />
                </th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Naissance</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold cursor-pointer select-none" style={{ color: '#8392a5' }} onClick={() => toggleSort('qualite')}>
                  Qualité <SortIcon col="qualite" />
                </th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>LV2</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr key={e.id} className="border-t" style={{ borderColor: '#f0f1f5' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#06072d' }}>{e.nom}</td>
                  <td className="px-3 py-3" style={{ color: '#575d78' }}>{e.prenom}</td>
                  <td className="text-center px-3 py-3 text-xs font-mono" style={{ color: '#8392a5' }}>{e.matricule}</td>
                  <td className="text-center px-3 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{
                      background: e.sexe === 'Féminin' ? '#fce7f3' : '#dbeafe',
                      color: e.sexe === 'Féminin' ? '#ec4899' : '#3b82f6',
                    }}>
                      {e.sexe === 'Féminin' ? 'F' : 'M'}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3 text-xs" style={{ color: '#575d78' }}>{e.date_naissance}</td>
                  <td className="text-center px-3 py-3">
                    {e.qualite === 'Redoublant' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#fff8e1', color: '#d4a017' }}>Red.</span>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#8392a5' }}>—</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-3 text-xs" style={{ color: '#8392a5' }}>
                    {e.lv2 !== 'Aucune' ? e.lv2.replace(/L\.V\.2\s*\(/, '').replace(')', '') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-cassie p-10 text-center">
          <UserCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#c0ccda' }} />
          <p className="text-sm font-medium" style={{ color: '#575d78' }}>
            {search ? 'Aucun élève trouvé' : 'Aucun élève dans cette classe'}
          </p>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-cassie p-4">
      <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#8392a5' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color, fontFamily: "'Oswald', sans-serif" }}>{value}</p>
    </div>
  );
}
