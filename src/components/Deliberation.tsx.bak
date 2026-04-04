import { useState, useCallback } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { AppData, PVConfig, JuryMember, SemesterView } from '../types';
import { getStatusCounts } from '../utils/calculator';
import { StatusBadge } from './Dashboard';
import { generatePV } from '../utils/pvGenerator';
import ExportButton from './ExportButton';
import type { ExportTableData } from '../utils/exportTable';

interface Props {
  data: AppData;
  onStudentClick: (s: import('../types').Student) => void;
  hasBothSemesters?: boolean;
  semesterView?: SemesterView;
  onSemesterViewChange?: (v: SemesterView) => void;
}

export default function Deliberation({ data, onStudentClick, hasBothSemesters, semesterView, onSemesterViewChange }: Props) {
  const students = data.students!;
  const { counts, s1Counts, srCounts } = getStatusCounts(students);
  const repechage = students.filter(s => s.eligibleRepechage);
  const groupInfo = data.parsedExcel;

  const getSummaryExport = useCallback((): ExportTableData => ({
    title: 'Tableau récapitulatif des résultats',
    subtitle: `${groupInfo?.groupName ?? ''} · ${groupInfo?.semester ?? ''}`,
    columns: ['Résultat', 'Session 1', 'Session SR', 'Total', '%'],
    rows: [
      ...(['ADMIS', 'AUTORISÉ', 'AJOURNÉ'] as const).map(st => [
        st, s1Counts[st], srCounts[st], counts[st],
        students.length > 0 ? `${Math.round((counts[st] / students.length) * 100)}%` : '0%',
      ]),
      ['Total', s1Counts.ADMIS + s1Counts.AUTORISÉ + s1Counts.AJOURNÉ,
        srCounts.ADMIS + srCounts.AUTORISÉ + srCounts.AJOURNÉ, students.length, '100%'],
    ],
    filename: 'recapitulatif_resultats',
  }), [counts, s1Counts, srCounts, students, groupInfo]);

  const getNominativeExport = useCallback((status: 'ADMIS' | 'AUTORISÉ' | 'AJOURNÉ'): ExportTableData => {
    const group = students.filter(s => s.status === status).sort((a, b) => b.semesterAverage - a.semesterAverage);
    return {
      title: `Liste nominative — ${status}`,
      subtitle: `${groupInfo?.groupName ?? ''} · ${groupInfo?.semester ?? ''}`,
      columns: ['Nom', 'Matricule', 'Moyenne', 'Crédits', 'Session'],
      rows: group.map(s => [s.name, s.matricule, s.semesterAverage.toFixed(2),
        `${s.totalCredits}/${s.ueResults.reduce((a, u) => a + u.totalCredits, 0)}`, s.session ?? 'S1']),
      filename: `liste_${status.toLowerCase()}`,
    };
  }, [students, groupInfo]);

  const getRepechageExport = useCallback((): ExportTableData => ({
    title: 'Cas de repêchage',
    columns: ['Nom', 'Matricule', 'Crédits', 'UE concernée', 'Moy. UE'],
    rows: repechage.map(s => [
      s.name, s.matricule,
      `${s.totalCredits}/${s.ueResults.reduce((a, u) => a + u.totalCredits, 0)}`,
      s.ueResults.find(u => u.ueCode === s.repechageUECode)?.ueName ?? s.repechageUECode ?? '',
      s.repechageUEAvg != null ? s.repechageUEAvg.toFixed(2) : '',
    ]),
    filename: 'cas_repechage',
  }), [repechage]);

  const [pvConfig, setPVConfig] = useState<PVConfig>({
    date: new Date().toLocaleDateString('fr-FR'),
    lieu: 'Abidjan',
    presidentJury: '',
    juryMembers: [
      { name: '', role: 'Directeur des Études' },
      { name: '', role: 'Responsable Pédagogique' },
    ],
    observationsDiverses: '',
  });
  const [generating, setGenerating] = useState(false);

  const updateJury = (i: number, field: keyof JuryMember, val: string) => {
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

  const handleGeneratePV = async () => {
    setGenerating(true);
    try {
      await generatePV(data, pvConfig);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Term filter */}
      {hasBothSemesters && onSemesterViewChange && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: '#8392a5' }}>Période :</span>
          <div className="flex items-center rounded p-0.5" style={{ background: '#f3f6f9' }}>
            {(['S1', 'S2', 'ANNUAL'] as const).map(sv => (
              <button
                key={sv}
                onClick={() => onSemesterViewChange(sv)}
                className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                style={semesterView === sv
                  ? { background: '#5556fd', color: 'white' }
                  : { color: '#575d78' }
                }
              >
                {sv === 'ANNUAL' ? 'Annuel' : sv}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e6e7ef' }}>
          <div>
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Tableau récapitulatif des résultats</h6>
            <p className="text-xs mt-0.5" style={{ color: '#8392a5' }}>{groupInfo?.groupName} · {groupInfo?.semester}</p>
          </div>
          <ExportButton getData={getSummaryExport} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Résultat</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Session 1</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Session SR</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#5556fd', background: '#f0f0ff' }}>Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {(['ADMIS', 'AUTORISÉ', 'AJOURNÉ'] as const).map(st => (
                <tr key={st} className="text-center border-b" style={{ borderColor: '#f3f6f9' }}>
                  <td className="px-4 py-3 text-left"><StatusBadge status={st} /></td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#575d78' }}>{s1Counts[st]}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#575d78' }}>{srCounts[st]}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#5556fd', background: '#f8f8ff' }}>{counts[st]}</td>
                  <td className="px-4 py-3" style={{ color: '#8392a5' }}>
                    {students.length > 0 ? Math.round((counts[st] / students.length) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="font-semibold text-center" style={{ background: '#f9f9fd' }}>
                <td className="px-4 py-3 text-left" style={{ color: '#06072d' }}>Total</td>
                <td className="px-4 py-3" style={{ color: '#575d78' }}>{s1Counts.ADMIS + s1Counts.AUTORISÉ + s1Counts.AJOURNÉ}</td>
                <td className="px-4 py-3" style={{ color: '#575d78' }}>{srCounts.ADMIS + srCounts.AUTORISÉ + srCounts.AJOURNÉ}</td>
                <td className="px-4 py-3" style={{ color: '#5556fd', background: '#f0f0ff' }}>{students.length}</td>
                <td className="px-4 py-3" style={{ color: '#575d78' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Nominative lists */}
      <div className="grid md:grid-cols-3 gap-4">
        {(['ADMIS', 'AUTORISÉ', 'AJOURNÉ'] as const).map(status => {
          const group = students.filter(s => s.status === status);
          const borderColors: Record<string, string> = { ADMIS: '#22d273', AUTORISÉ: '#ffc107', AJOURNÉ: '#dc3545' };
          const headerBg: Record<string, string> = { ADMIS: '#e6f9ef', AUTORISÉ: '#fff8e1', AJOURNÉ: '#fce8ea' };
          const headerColor: Record<string, string> = { ADMIS: '#1a8a4d', AUTORISÉ: '#b8860b', AJOURNÉ: '#a71d2a' };
          return (
            <div key={status} className="card-cassie overflow-hidden" style={{ borderTop: `3px solid ${borderColors[status]}` }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: headerBg[status], color: headerColor[status] }}>
                <h6 className="font-semibold text-sm">{status} ({group.length})</h6>
                <ExportButton getData={() => getNominativeExport(status)} />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {group.length === 0 ? (
                  <p className="px-4 py-3 text-sm italic" style={{ color: '#c0ccda' }}>Aucun étudiant</p>
                ) : (
                  <ul>
                    {group.sort((a, b) => b.semesterAverage - a.semesterAverage).map(s => (
                      <li key={s.matricule}
                        className="px-4 py-2 hover:bg-[#f9f9fd] cursor-pointer text-sm border-b transition-colors"
                        style={{ borderColor: '#f3f6f9' }}
                        onClick={() => onStudentClick(s)}>
                        <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                        <div className="text-xs" style={{ color: '#8392a5' }}>
                          {s.matricule} · {s.semesterAverage.toFixed(2)}/20 · {s.totalCredits} cr.
                          {s.session === 'SR' && <span className="ml-1" style={{ color: '#7c3aed' }}>[SR]</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Repêchage */}
      {repechage.length > 0 && (
        <div className="card-cassie overflow-hidden" style={{ borderLeft: '3px solid #fca665' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ background: '#fff8f0', borderColor: '#fde8d0' }}>
            <div>
              <h6 className="font-semibold text-sm" style={{ color: '#b86e1d' }}>Cas de repêchage ({repechage.length})</h6>
            <p className="text-[11px] mt-0.5" style={{ color: '#c07a2a' }}>
              Critères : ≥ 80% des crédits · Moyenne UE défaillante ≥ 9,50/20 · Décision du jury
            </p>
            </div>
            <ExportButton getData={getRepechageExport} />
          </div>
          <ul>
            {repechage.map(s => {
              const failedUE = s.ueResults.find(u => u.ueCode === s.repechageUECode);
              return (
                <li key={s.matricule}
                  className="px-5 py-3 hover:bg-[#fffaf5] cursor-pointer flex flex-wrap gap-4 items-center border-b transition-colors"
                  style={{ borderColor: '#fde8d0' }}
                  onClick={() => onStudentClick(s)}>
                  <div className="flex-1">
                    <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                    <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                  </div>
                  <div className="text-sm" style={{ color: '#575d78' }}>
                    <span className="font-medium">{s.totalCredits}</span>/{s.ueResults.reduce((acc, u) => acc + u.totalCredits, 0)} crédits
                  </div>
                  <div className="text-sm">
                    <span style={{ color: '#8392a5' }}>UE : </span>
                    <span className="font-medium" style={{ color: '#b86e1d' }}>{failedUE?.ueName}</span>
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#b86e1d' }}>{s.repechageUEAvg?.toFixed(2)}/20</div>
                </li>
              );
            })}
          </ul>
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
          <LabeledInput label="Président du jury" value={pvConfig.presidentJury}
            onChange={v => setPVConfig(p => ({ ...p, presidentJury: v }))} placeholder="Nom et titre du président" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: '#373857' }}>Membres du jury</label>
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

          <button onClick={handleGeneratePV} disabled={generating}
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
