/**
 * DRENADashboard — Regional-level overview.
 *
 * Shows: all establishments in the selected DRENA with stats, KPIs, rankings.
 */
import { useState, useEffect, useMemo } from 'react';
import { Building2, Users, TrendingUp, Award, ChevronRight } from 'lucide-react';
import type { Etablissement } from '../../types/multiLevel';
import { getEtablissementsByDRENA } from '../../lib/educationDB';
import { useNavigation } from '../../contexts/NavigationContext';

export default function DRENADashboard() {
  const { state, currentDRENA, goToEtablissement } = useNavigation();
  const [etabs, setEtabs] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.drena_id) return;
    getEtablissementsByDRENA(state.drena_id)
      .then(setEtabs)
      .finally(() => setLoading(false));
  }, [state.drena_id]);

  const totals = useMemo(() => ({
    etablissements: etabs.length,
    effectif: etabs.reduce((s, e) => s + e.structure_classes.effectifs.total, 0),
    enseignants: etabs.reduce((s, e) => s + e.nb_enseignants, 0),
    classes: etabs.reduce((s, e) => s + e.structure_classes.nb_classes.total, 0),
  }), [etabs]);

  const sorted = useMemo(() =>
    [...etabs].sort((a, b) => b.structure_classes.effectifs.total - a.structure_classes.effectifs.total),
  [etabs]);

  if (loading) {
    return <div className="text-center py-10 text-sm" style={{ color: '#8392a5' }}>Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold" style={{ color: '#06072d' }}>
        {currentDRENA?.nom ?? 'DRENA'}
      </h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Établissements" value={totals.etablissements} color="#5556fd" icon={<Building2 className="w-5 h-5" />} />
        <KPI label="Classes" value={totals.classes.toLocaleString()} color="#7c3aed" icon={<Award className="w-5 h-5" />} />
        <KPI label="Élèves" value={totals.effectif.toLocaleString()} color="#22d273" icon={<Users className="w-5 h-5" />} />
        <KPI label="Enseignants" value={totals.enseignants.toLocaleString()} color="#f59e0b" icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      {/* Establishments table */}
      {sorted.length > 0 ? (
        <div className="card-cassie overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Établissement</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Code</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Type</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Classes</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Élèves</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Ens.</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Chef</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr
                  key={e.id}
                  className="border-t cursor-pointer transition-colors hover:bg-[#f9f9fd]"
                  style={{ borderColor: '#f0f1f5' }}
                  onClick={() => goToEtablissement(e.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: '#06072d' }}>{e.nom}</p>
                    {e.localite && (
                      <p className="text-[10px]" style={{ color: '#8392a5' }}>{e.localite}</p>
                    )}
                  </td>
                  <td className="text-center px-3 py-3 text-xs" style={{ color: '#575d78' }}>{e.code}</td>
                  <td className="text-center px-3 py-3 text-xs" style={{ color: '#575d78' }}>{e.type_focus}</td>
                  <td className="text-center px-3 py-3 font-medium" style={{ color: '#575d78' }}>{e.structure_classes.nb_classes.total}</td>
                  <td className="text-center px-3 py-3 font-medium" style={{ color: '#575d78' }}>{e.structure_classes.effectifs.total.toLocaleString()}</td>
                  <td className="text-center px-3 py-3" style={{ color: '#575d78' }}>{e.nb_enseignants}</td>
                  <td className="text-center px-3 py-3 text-xs" style={{ color: '#8392a5' }}>
                    {e.chef_etablissement?.nom ? (
                      <span title={e.chef_etablissement.nom}>
                        {e.chef_etablissement.nom.length > 20 ? `${e.chef_etablissement.nom.slice(0, 18)}…` : e.chef_etablissement.nom}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-2">
                    <ChevronRight className="w-4 h-4" style={{ color: '#c0ccda' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-cassie p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#c0ccda' }} />
          <p className="text-sm font-medium" style={{ color: '#575d78' }}>Aucun établissement dans cette DRENA</p>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
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
