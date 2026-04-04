import { useState, useCallback, useMemo } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { K12Student, TermView, PromotionStatus } from '../types/k12';
import { computeClassStats } from '../utils/k12RulesEngine';
import { PromotionBadge } from './Dashboard';
import ExportButton from './ExportButton';
import type { ExportTableData } from '../utils/exportTable';

interface Props {
  students: K12Student[];
  termView: TermView;
  onTermViewChange: (v: TermView) => void;
  onStudentClick: (s: K12Student) => void;
  schoolName?: string;
}

export default function Deliberation({ students, termView, onTermViewChange, onStudentClick, schoolName }: Props) {
  const stats = useMemo(() => computeClassStats(students), [students]);
  const promoted = useMemo(() => students.filter(s => s.yearResult?.promotionStatus === 'ADMIS').sort((a, b) => (b.yearResult?.yearAverage ?? 0) - (a.yearResult?.yearAverage ?? 0)), [students]);
  const retained = useMemo(() => students.filter(s => s.yearResult?.promotionStatus === 'REDOUBLE').sort((a, b) => (b.yearResult?.yearAverage ?? 0) - (a.yearResult?.yearAverage ?? 0)), [students]);
  const expelled = useMemo(() => students.filter(s => s.yearResult?.promotionStatus === 'EXCLU').sort((a, b) => (b.yearResult?.yearAverage ?? 0) - (a.yearResult?.yearAverage ?? 0)), [students]);

  const getSummaryExport = useCallback((): ExportTableData => ({
    title: 'Tableau récapitulatif des résultats',
    columns: ['Résultat', 'Effectif', '%'],
    rows: [
      ['ADMIS', stats.promoted, students.length > 0 ? `${Math.round((stats.promoted / students.length) * 100)}%` : '0%'],
      ['REDOUBLE', stats.retained, students.length > 0 ? `${Math.round((stats.retained / students.length) * 100)}%` : '0%'],
      ['EXCLU', stats.expelled, students.length > 0 ? `${Math.round((stats.expelled / students.length) * 100)}%` : '0%'],
      ['Total', students.length, '100%'],
    ],
    filename: 'recapitulatif_resultats',
  }), [stats, students]);

  const getNominativeExport = useCallback((status: PromotionStatus): ExportTableData => {
    const group = students.filter(s => s.yearResult?.promotionStatus === status).sort((a, b) => (b.yearResult?.yearAverage ?? 0) - (a.yearResult?.yearAverage ?? 0));
    return {
      title: `Liste nominative — ${status}`,
      columns: ['Nom', 'Matricule', 'Moy. Annuelle', 'Classe', 'Filière'],
      rows: group.map(s => [
        s.fullName, s.matricule,
        s.yearResult?.yearAverage?.toFixed(2) ?? '—',
        s.className,
        s.branch ?? '—',
      ]),
      filename: `liste_${(status ?? 'inconnu').toLowerCase()}`,
    };
  }, [students]);

  // PV config
  const [pvConfig, setPVConfig] = useState({
    date: new Date().toLocaleDateString('fr-FR'),
    lieu: 'Abidjan',
    presidentJury: '',
    juryMembers: [
      { name: '', role: 'Proviseur' },
      { name: '', role: 'Directeur des Études' },
    ],
    observationsDiverses: '',
  });
  const [generating] = useState(false);

  const updateJury = (i: number, field: 'name' | 'role', val: string) => {
    setPVConfig(prev => {
      const members = [...prev.juryMembers];
      members[i] = { ...members[i], [field]: val };
      return { ...prev, juryMembers: members };
    });
  };

  const addJuryMember = () =>
    setPVConfig(prev => ({ ...prev, juryMembers: [...prev.juryMembers, { name: '', role: '' }] }));

  const removeJuryMember = (i: number) =>
    setPVConfig(prev => ({ ...prev, juryMembers: prev.juryMembers.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-5">
      {/* Term toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium" style={{ color: '#8392a5' }}>Période :</span>
        <div className="flex items-center rounded p-0.5" style={{ background: '#f3f6f9' }}>
          {(['T1', 'T2', 'T3', 'ANNUAL'] as const).map(tv => (
            <button
              key={tv}
              onClick={() => onTermViewChange(tv)}
              className="px-3 py-1.5 text-xs font-medium rounded transition-all"
              style={termView === tv
                ? { background: '#5556fd', color: 'white' }
                : { color: '#575d78' }
              }
            >
              {tv === 'ANNUAL' ? 'Annuel' : tv}
            </button>
          ))}
        </div>
      </div>

      {/* Summary table */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e6e7ef' }}>
          <div>
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Tableau récapitulatif des résultats</h6>
            <p className="text-xs mt-0.5" style={{ color: '#8392a5' }}>{schoolName ?? 'K12net Dashboard'}</p>
          </div>
          <ExportButton getData={getSummaryExport} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Résultat</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#5556fd', background: '#f0f0ff' }}>Effectif</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {([['ADMIS', stats.promoted], ['REDOUBLE', stats.retained], ['EXCLU', stats.expelled]] as const).map(([st, count]) => (
                <tr key={st} className="text-center border-b" style={{ borderColor: '#f3f6f9' }}>
                  <td className="px-4 py-3 text-left"><PromotionBadge status={st} /></td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#5556fd', background: '#f8f8ff' }}>{count}</td>
                  <td className="px-4 py-3" style={{ color: '#8392a5' }}>
                    {students.length > 0 ? Math.round((count / students.length) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="font-semibold text-center" style={{ background: '#f9f9fd' }}>
                <td className="px-4 py-3 text-left" style={{ color: '#06072d' }}>Total</td>
                <td className="px-4 py-3" style={{ color: '#5556fd', background: '#f0f0ff' }}>{students.length}</td>
                <td className="px-4 py-3" style={{ color: '#575d78' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Nominative lists */}
      <div className="grid md:grid-cols-3 gap-4">
        {([
          { status: 'ADMIS' as const, list: promoted, border: '#22d273', headerBg: '#e6f9ef', headerColor: '#1a8a4d' },
          { status: 'REDOUBLE' as const, list: retained, border: '#ffc107', headerBg: '#fff8e1', headerColor: '#b8860b' },
          { status: 'EXCLU' as const, list: expelled, border: '#dc3545', headerBg: '#fce8ea', headerColor: '#a71d2a' },
        ]).map(({ status, list, border, headerBg, headerColor }) => (
          <div key={status} className="card-cassie overflow-hidden" style={{ borderTop: `3px solid ${border}` }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: headerBg, color: headerColor }}>
              <h6 className="font-semibold text-sm">{status} ({list.length})</h6>
              <ExportButton getData={() => getNominativeExport(status)} />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {list.length === 0 ? (
                <p className="px-4 py-3 text-sm italic" style={{ color: '#c0ccda' }}>Aucun élève</p>
              ) : (
                <ul>
                  {list.map(s => (
                    <li key={s.matricule}
                      className="px-4 py-2 hover:bg-[#f9f9fd] cursor-pointer text-sm border-b transition-colors"
                      style={{ borderColor: '#f3f6f9' }}
                      onClick={() => onStudentClick(s)}>
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.fullName}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>
                        {s.matricule} · {s.yearResult?.yearAverage?.toFixed(2) ?? '—'}/20
                        {s.branch && <span className="ml-1">[{s.branch}]</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Distinctions & Sanctions summary per term */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: '#e6e7ef' }}>
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Distinctions et sanctions par trimestre</h6>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Trimestre</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#22d273' }}>THF</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#5556fd' }}>THE</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#ffc107' }}>TH</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#dc3545' }}>BTI</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#fca665' }}>AVT</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#7c3aed' }}>BMC</th>
                <th className="px-3 py-3 text-center text-xs font-medium" style={{ color: '#c084fc' }}>AMC</th>
              </tr>
            </thead>
            <tbody>
              {(['T1', 'T2', 'T3'] as const).map(tid => {
                const ts = stats.termStats[tid];
                return (
                  <tr key={tid} className="border-b text-center" style={{ borderColor: '#f3f6f9' }}>
                    <td className="px-4 py-3 text-left font-medium" style={{ color: '#06072d' }}>{tid}</td>
                    <td className="px-3 py-3" style={{ color: '#22d273' }}>{ts.distinctions.THF + ts.distinctions.THFR || '—'}</td>
                    <td className="px-3 py-3" style={{ color: '#5556fd' }}>{ts.distinctions.THE + ts.distinctions.THER || '—'}</td>
                    <td className="px-3 py-3" style={{ color: '#ffc107' }}>{ts.distinctions.TH + ts.distinctions.THR || '—'}</td>
                    <td className="px-3 py-3" style={{ color: '#dc3545' }}>{ts.sanctions.BTI || '—'}</td>
                    <td className="px-3 py-3" style={{ color: '#fca665' }}>{ts.sanctions.AVT || '—'}</td>
                    <td className="px-3 py-3" style={{ color: '#7c3aed' }}>{ts.sanctions.BMC || '—'}</td>
                    <td className="px-3 py-3" style={{ color: '#c084fc' }}>{ts.sanctions.AMC || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch orientation (for lycée students) */}
      {students.some(s => s.yearResult?.suggestedBranch) && (
        <div className="card-cassie overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Orientation filière</h6>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Élève</th>
                  <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Moy. Annuelle</th>
                  <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Filière actuelle</th>
                  <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#5556fd' }}>Filière suggérée</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter(s => s.yearResult?.suggestedBranch)
                  .sort((a, b) => (b.yearResult?.yearAverage ?? 0) - (a.yearResult?.yearAverage ?? 0))
                  .map(s => (
                    <tr key={s.matricule} className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                      style={{ borderColor: '#f3f6f9' }} onClick={() => onStudentClick(s)}>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: '#06072d' }}>{s.fullName}</div>
                        <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold"
                        style={{ color: (s.yearResult?.yearAverage ?? 0) >= 10 ? '#22d273' : '#dc3545' }}>
                        {s.yearResult?.yearAverage?.toFixed(2) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: '#575d78' }}>{s.branch ?? '—'}</td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color: '#5556fd' }}>
                        {s.yearResult?.suggestedBranch}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PV Generator */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: '#e6e7ef' }}>
          <FileText className="w-5 h-5" style={{ color: '#5556fd' }} />
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Générer le Procès-Verbal</h6>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <LabeledInput label="Date" value={pvConfig.date} onChange={v => setPVConfig(p => ({ ...p, date: v }))} />
            <LabeledInput label="Lieu" value={pvConfig.lieu} onChange={v => setPVConfig(p => ({ ...p, lieu: v }))} />
          </div>
          <LabeledInput label="Président du conseil" value={pvConfig.presidentJury}
            onChange={v => setPVConfig(p => ({ ...p, presidentJury: v }))} placeholder="Nom et titre du président" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: '#373857' }}>Membres du conseil</label>
              <button onClick={addJuryMember} className="text-xs flex items-center gap-1 font-medium" style={{ color: '#5556fd' }}>
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {pvConfig.juryMembers.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input className="flex-1 text-sm border rounded px-3 py-1.5 focus:outline-none" style={{ borderColor: '#e6e7ef' }}
                    placeholder="Nom" value={m.name} onChange={e => updateJury(i, 'name', e.target.value)} />
                  <input className="flex-1 text-sm border rounded px-3 py-1.5 focus:outline-none" style={{ borderColor: '#e6e7ef' }}
                    placeholder="Fonction" value={m.role} onChange={e => updateJury(i, 'role', e.target.value)} />
                  <button onClick={() => removeJuryMember(i)} className="p-1" style={{ color: '#dc3545' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Divers / Observations</label>
            <textarea rows={3}
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none resize-none"
              style={{ borderColor: '#e6e7ef' }}
              placeholder="Points divers à mentionner dans le PV…"
              value={pvConfig.observationsDiverses}
              onChange={e => setPVConfig(p => ({ ...p, observationsDiverses: e.target.value }))} />
          </div>

          <button disabled={generating}
            className="w-full py-3 text-white font-semibold rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#5556fd' }}>
            <FileText className="w-4 h-4" />
            {generating ? 'Génération en cours…' : 'Télécharger le PV (.docx)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm border rounded px-3 py-2 focus:outline-none" style={{ borderColor: '#e6e7ef' }} />
    </div>
  );
}
