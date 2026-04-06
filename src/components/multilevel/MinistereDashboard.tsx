/**
 * MinistereDashboard — National-level overview.
 *
 * Shows: all établissements with stats, national KPIs.
 */
import { useState, useEffect, useMemo } from 'react';
import { Building2, Users, TrendingUp, Award, ChevronRight, Search } from 'lucide-react';
import type { Etablissement } from '../../types/multiLevel';
import { getAllEtablissements } from '../../lib/educationDB';
import { useNavigation } from '../../contexts/NavigationContext';

export default function MinistereDashboard() {
  const { goToEtablissement } = useNavigation();
  const [etabs, setEtabs] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getAllEtablissements()
      .then(e => setEtabs(e))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => ({
    etablissements: etabs.length,
    effectif: etabs.reduce((s, e) => s + (e.structure_classes?.effectifs?.total ?? 0), 0),
    enseignants: etabs.reduce((s, e) => s + (e.nb_enseignants ?? 0), 0),
    classes: etabs.reduce((s, e) => s + (e.structure_classes?.nb_classes?.total ?? 0), 0),
  }), [etabs]);

  const filterLower = filter.toLowerCase();
  const visible = useMemo(() => {
    const sorted = [...etabs].sort((a, b) => a.nom.localeCompare(b.nom));
    if (!filterLower) return sorted;
    return sorted.filter(e =>
      e.nom.toLowerCase().includes(filterLower) ||
      (e.code ?? '').toLowerCase().includes(filterLower));
  }, [etabs, filterLower]);

  if (loading) {
    return <div className="text-center py-10 text-sm" style={{ color: '#8392a5' }}>Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard icon={<Building2 className="w-5 h-5" />} label="Établissements" value={totals.etablissements} color="#5556fd" />
        <KPICard icon={<Users className="w-5 h-5" />} label="Élèves" value={totals.effectif.toLocaleString()} color="#22d273" />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Enseignants" value={totals.enseignants.toLocaleString()} color="#f59e0b" />
        <KPICard icon={<Award className="w-5 h-5" />} label="Classes" value={totals.classes.toLocaleString()} color="#dc3545" />
      </div>

      {/* Établissements list */}
      {etabs.length > 0 ? (
        <div className="space-y-3">
          {/* Search */}
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

          <div className="card-cassie overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Établissement</th>
                  <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Code</th>
                  <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Classes</th>
                  <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Élèves</th>
                  <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Enseignants</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(e => (
                  <tr
                    key={e.id}
                    className="border-t cursor-pointer transition-colors hover:bg-[#f9f9fd]"
                    style={{ borderColor: '#f0f1f5' }}
                    onClick={() => goToEtablissement(e.id)}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: '#06072d' }}>{e.nom}</td>
                    <td className="text-center px-3 py-3 text-xs" style={{ color: '#8392a5' }}>{e.code || '—'}</td>
                    <td className="text-center px-3 py-3" style={{ color: '#575d78' }}>{e.structure_classes?.nb_classes?.total ?? 0}</td>
                    <td className="text-center px-3 py-3" style={{ color: '#575d78' }}>{(e.structure_classes?.effectifs?.total ?? 0).toLocaleString()}</td>
                    <td className="text-center px-3 py-3" style={{ color: '#575d78' }}>{e.nb_enseignants ?? 0}</td>
                    <td className="px-2">
                      <ChevronRight className="w-4 h-4" style={{ color: '#c0ccda' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && filter && (
              <div className="text-xs text-center py-4" style={{ color: '#8392a5' }}>
                Aucun établissement trouvé pour « {filter} »
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card-cassie p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#c0ccda' }} />
          <p className="text-sm font-medium" style={{ color: '#575d78' }}>Aucune donnée importée</p>
          <p className="text-xs mt-1" style={{ color: '#8392a5' }}>
            Importez des données depuis l'onglet Administration
          </p>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card-cassie p-4">
      <div className="flex items-center gap-2 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: '#06072d', fontFamily: "'Oswald', sans-serif" }}>{value}</p>
    </div>
  );
}
