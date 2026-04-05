/**
 * EtablissementDashboard — School-level overview.
 *
 * Shows: classes, student counts, level breakdown, KPIs.
 */
import { useState, useEffect, useMemo } from 'react';
import { Users, BookOpen, Award, ChevronRight, BarChart3 } from 'lucide-react';
import type { ClasseML, EleveML, NiveauScolaire } from '../../types/multiLevel';
import { getClassesByEtablissement, getElevesByEtablissement } from '../../lib/educationDB';
import { useNavigation } from '../../contexts/NavigationContext';

interface ClassSummary {
  classe: ClasseML;
  effectif: number;
  nbGarcons: number;
  nbFilles: number;
  nbRedoublants: number;
}

export default function EtablissementDashboard() {
  const { state, currentEtablissement, goToClasse, anneeScolaire } = useNavigation();
  const [classes, setClasses] = useState<ClasseML[]>([]);
  const [eleves, setEleves] = useState<EleveML[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.etablissement_id) return;
    Promise.all([
      getClassesByEtablissement(state.etablissement_id, anneeScolaire),
      getElevesByEtablissement(state.etablissement_id, anneeScolaire),
    ])
      .then(([c, e]) => { setClasses(c); setEleves(e); })
      .finally(() => setLoading(false));
  }, [state.etablissement_id, anneeScolaire]);

  const classSummaries = useMemo((): ClassSummary[] => {
    return classes.map(c => {
      const classEleves = eleves.filter(e => e.classe_id === c.id);
      return {
        classe: c,
        effectif: classEleves.length,
        nbGarcons: classEleves.filter(e => e.sexe === 'Masculin').length,
        nbFilles: classEleves.filter(e => e.sexe === 'Féminin').length,
        nbRedoublants: classEleves.filter(e => e.qualite === 'Redoublant').length,
      };
    }).sort((a, b) => a.classe.nom.localeCompare(b.classe.nom));
  }, [classes, eleves]);

  const levelBreakdown = useMemo(() => {
    const map = new Map<NiveauScolaire, { classes: number; eleves: number }>();
    for (const c of classSummaries) {
      const prev = map.get(c.classe.niveau) ?? { classes: 0, eleves: 0 };
      map.set(c.classe.niveau, {
        classes: prev.classes + 1,
        eleves: prev.eleves + c.effectif,
      });
    }
    return Array.from(map.entries());
  }, [classSummaries]);

  const totals = useMemo(() => ({
    classes: classes.length,
    eleves: eleves.length,
    garcons: eleves.filter(e => e.sexe === 'Masculin').length,
    filles: eleves.filter(e => e.sexe === 'Féminin').length,
    redoublants: eleves.filter(e => e.qualite === 'Redoublant').length,
  }), [classes, eleves]);

  if (loading) {
    return <div className="text-center py-10 text-sm" style={{ color: '#8392a5' }}>Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#06072d' }}>
          {currentEtablissement?.nom ?? 'Établissement'}
        </h2>
        {currentEtablissement?.chef_etablissement && (
          <p className="text-xs mt-1" style={{ color: '#8392a5' }}>
            Chef d'établissement : {currentEtablissement.chef_etablissement.nom}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KPI label="Classes" value={totals.classes} color="#5556fd" icon={<BookOpen className="w-5 h-5" />} />
        <KPI label="Élèves" value={totals.eleves} color="#22d273" icon={<Users className="w-5 h-5" />} />
        <KPI label="Garçons" value={totals.garcons} color="#3b82f6" icon={<Users className="w-5 h-5" />} />
        <KPI label="Filles" value={totals.filles} color="#ec4899" icon={<Users className="w-5 h-5" />} />
        <KPI label="Redoublants" value={totals.redoublants} color="#f59e0b" icon={<Award className="w-5 h-5" />} />
      </div>

      {/* Level breakdown */}
      {levelBreakdown.length > 0 && (
        <div className="card-cassie p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#8392a5' }}>
            Répartition par niveau
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {levelBreakdown.map(([niveau, data]) => (
              <div key={niveau} className="p-3 rounded-lg text-center" style={{ background: '#f9f9fd' }}>
                <p className="text-xs font-bold" style={{ color: '#06072d' }}>{niveau}</p>
                <p className="text-lg font-bold mt-1" style={{ color: '#5556fd', fontFamily: "'Oswald', sans-serif" }}>{data.eleves}</p>
                <p className="text-[10px]" style={{ color: '#8392a5' }}>{data.classes} classe{data.classes > 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classes table */}
      {classSummaries.length > 0 ? (
        <div className="card-cassie overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Classe</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Niveau</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Série</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Effectif</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>G</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>F</th>
                <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8392a5' }}>Red.</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {classSummaries.map(s => (
                <tr
                  key={s.classe.id}
                  className="border-t cursor-pointer transition-colors hover:bg-[#f9f9fd]"
                  style={{ borderColor: '#f0f1f5' }}
                  onClick={() => goToClasse(s.classe.id)}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: '#06072d' }}>{s.classe.nom}</td>
                  <td className="text-center px-3 py-3" style={{ color: '#575d78' }}>{s.classe.niveau}</td>
                  <td className="text-center px-3 py-3" style={{ color: '#575d78' }}>{s.classe.serie ?? '—'}</td>
                  <td className="text-center px-3 py-3 font-medium" style={{ color: '#06072d' }}>{s.effectif}</td>
                  <td className="text-center px-3 py-3" style={{ color: '#3b82f6' }}>{s.nbGarcons}</td>
                  <td className="text-center px-3 py-3" style={{ color: '#ec4899' }}>{s.nbFilles}</td>
                  <td className="text-center px-3 py-3" style={{ color: s.nbRedoublants > 0 ? '#f59e0b' : '#8392a5' }}>
                    {s.nbRedoublants}
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
          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: '#c0ccda' }} />
          <p className="text-sm font-medium" style={{ color: '#575d78' }}>Aucun élève importé</p>
          <p className="text-xs mt-1" style={{ color: '#8392a5' }}>
            Importez le fichier <strong>listes_eleves.xlsx</strong> depuis l'onglet Administration
          </p>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
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
