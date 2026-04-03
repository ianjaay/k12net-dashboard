import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer,
} from 'recharts';
import { Users, TrendingUp, Award, AlertTriangle, BookOpen, X, RefreshCw, ChevronDown, ChevronUp, ShieldCheck, Info } from 'lucide-react';
import type { Student, AppData } from '../types';
import { computeStats, getStatusCounts, getUEStats, getECUEStats, getSREligibleStudents } from '../utils/calculator';
import ExportButton from './ExportButton';
import type { ExportTableData } from '../utils/exportTable';

interface Props {
  data: AppData;
  onStudentClick: (student: Student) => void;
}

const STATUS_COLORS = { ADMIS: '#22d273', AUTORISÉ: '#ffc107', AJOURNÉ: '#dc3545' };

export default function Dashboard({ data, onStudentClick }: Props) {
  const students = data.students!;
  const stats = computeStats(students);
  const { counts } = getStatusCounts(students);
  const ueStats = getUEStats(students);
  const ecueStats = getECUEStats(students);
  const repechageStudents = students.filter(s => s.eligibleRepechage);
  const srEligible = useMemo(() => getSREligibleStudents(students), [students]);
  const autoriseStudents = useMemo(() => students.filter(s => s.status === 'AUTORISÉ'), [students]);
  const unapprovedEntries = useMemo(() => students.flatMap(student =>
    student.ueResults.flatMap(ue =>
      ue.ecueResults
        .filter(ecue => !ecue.approved)
        .map(ecue => {
          const flaggedFields = ([
            ['CCC', ecue.approvalFlags.ccc],
            ['ETS', ecue.approvalFlags.ets],
            ['Session 1', ecue.approvalFlags.session1],
            ['Session 2', ecue.approvalFlags.session2],
            ['Moyenne', ecue.approvalFlags.fileAvg],
          ] as const)
            .filter(([, approved]) => !approved)
            .map(([label]) => label);

          return {
            studentName: student.name,
            matricule: student.matricule,
            ueName: ue.ueName,
            ecueName: ecue.ecueName,
            ccc: ecue.ccc,
            ets: ecue.ets,
            session1: ecue.session1,
            session2: ecue.session2,
            average: ecue.fileAvg ?? ecue.average,
            flaggedFields,
          };
        })
    )
  ), [students]);
  const unapprovedStudentCount = useMemo(() => new Set(unapprovedEntries.map(entry => entry.matricule)).size, [unapprovedEntries]);
  const unapprovedSubjects = useMemo(() => {
    const grouped = new Map<string, {
      ueName: string;
      ecueName: string;
      studentCount: number;
      occurrenceCount: number;
      flaggedFields: string[];
    }>();

    for (const entry of unapprovedEntries) {
      const key = `${entry.ueName}__${entry.ecueName}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.occurrenceCount += 1;
        existing.studentCount += 1;
        existing.flaggedFields = [...new Set([...existing.flaggedFields, ...entry.flaggedFields])];
      } else {
        grouped.set(key, {
          ueName: entry.ueName,
          ecueName: entry.ecueName,
          studentCount: 1,
          occurrenceCount: 1,
          flaggedFields: [...entry.flaggedFields],
        });
      }
    }

    return [...grouped.values()].sort((a, b) =>
      a.ueName.localeCompare(b.ueName, 'fr', { sensitivity: 'base' })
      || a.ecueName.localeCompare(b.ecueName, 'fr', { sensitivity: 'base' })
    );
  }, [unapprovedEntries]);

  const [selectedUE, setSelectedUE] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Sort state per table
  type SortDir = 'asc' | 'desc';
  const [sorts, setSorts] = useState<Record<string, { key: string; dir: SortDir }>>({});
  const toggleSort = (table: string, key: string) => {
    setSorts(prev => {
      const cur = prev[table];
      if (cur?.key === key) return { ...prev, [table]: { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      return { ...prev, [table]: { key, dir: 'desc' } };
    });
  };

  const filteredECUEStats = useMemo(() => {
    if (!selectedUE) return ecueStats;
    return ecueStats.filter(e => e.ueCode === selectedUE);
  }, [ecueStats, selectedUE]);

  const selectedUEName = selectedUE
    ? ueStats.find(u => u.ueCode === selectedUE)?.ueName ?? selectedUE
    : null;

  // Sorted repêchage
  const sortedRepechage = useMemo(() => {
    const s = sorts.repechage;
    if (!s) return repechageStudents;
    return [...repechageStudents].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (s.key === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (s.key === 'credits') { va = a.totalCredits; vb = b.totalCredits; }
      else if (s.key === 'avg') { va = a.semesterAverage; vb = b.semesterAverage; }
      else if (s.key === 'ueAvg') { va = a.repechageUEAvg ?? 0; vb = b.repechageUEAvg ?? 0; }
      if (va < vb) return s.dir === 'asc' ? -1 : 1;
      if (va > vb) return s.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [repechageStudents, sorts.repechage]);

  // Sorted SR eligible
  const sortedSR = useMemo(() => {
    const s = sorts.sr;
    if (!s) return srEligible;
    return [...srEligible].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (s.key === 'name') { va = a.student.name.toLowerCase(); vb = b.student.name.toLowerCase(); }
      else if (s.key === 'avg') { va = a.student.semesterAverage; vb = b.student.semesterAverage; }
      else if (s.key === 'count') { va = a.failedECUEs.length; vb = b.failedECUEs.length; }
      if (va < vb) return s.dir === 'asc' ? -1 : 1;
      if (va > vb) return s.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [srEligible, sorts.sr]);

  // Sorted autorisés
  const sortedAutorise = useMemo(() => {
    const s = sorts.autorise;
    if (!s) return autoriseStudents;
    return [...autoriseStudents].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (s.key === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (s.key === 'avg') { va = a.semesterAverage; vb = b.semesterAverage; }
      else if (s.key === 'credits') { va = a.totalCredits; vb = b.totalCredits; }
      if (va < vb) return s.dir === 'asc' ? -1 : 1;
      if (va > vb) return s.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [autoriseStudents, sorts.autorise]);

  // Sorted top students
  const topStudents = useMemo(() => {
    const base = [...students].sort((a, b) => b.semesterAverage - a.semesterAverage).slice(0, 5);
    const s = sorts.top;
    if (!s) return base;
    return [...base].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (s.key === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (s.key === 'avg') { va = a.semesterAverage; vb = b.semesterAverage; }
      else if (s.key === 'credits') { va = a.totalCredits; vb = b.totalCredits; }
      else if (s.key === 'status') { va = a.status; vb = b.status; }
      if (va < vb) return s.dir === 'asc' ? -1 : 1;
      if (va > vb) return s.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, sorts.top]);

  const getAutoriseExport = useCallback((): ExportTableData => ({
    title: 'Étudiants autorisés',
    columns: ['Nom', 'Matricule', 'Crédits', 'Moy. semestrielle'],
    rows: autoriseStudents.map(s => [
      s.name, s.matricule,
      `${s.totalCredits}/${s.ueResults.reduce((a, u) => a + u.totalCredits, 0)}`,
      s.semesterAverage.toFixed(2),
    ]),
    filename: 'etudiants_autorises',
  }), [autoriseStudents]);

  const getRepechageExport = useCallback((): ExportTableData => ({
    title: 'Cas de repêchage',
    columns: ['Nom', 'Matricule', 'Crédits', 'Moy. semestrielle', 'UE concernée', 'Moy. UE'],
    rows: repechageStudents.map(s => [
      s.name, s.matricule,
      `${s.totalCredits}/${s.ueResults.reduce((a, u) => a + u.totalCredits, 0)}`,
      s.semesterAverage.toFixed(2),
      s.ueResults.find(u => u.ueCode === s.repechageUECode)?.ueName ?? s.repechageUECode ?? '',
      s.repechageUEAvg != null ? s.repechageUEAvg.toFixed(2) : '',
    ]),
    filename: 'cas_repechage',
  }), [repechageStudents]);

  const getTopStudentsExport = useCallback((): ExportTableData => {
    const top = [...students].sort((a, b) => b.semesterAverage - a.semesterAverage).slice(0, 5);
    return {
      title: 'Meilleurs étudiants',
      columns: ['Rang', 'Nom', 'Matricule', 'Moyenne', 'Crédits', 'Statut'],
      rows: top.map((s, i) => [
        `#${i + 1}`, s.name, s.matricule, s.semesterAverage.toFixed(2),
        `${s.totalCredits}/${s.ueResults.reduce((a, u) => a + u.totalCredits, 0)}`, s.status,
      ]),
      filename: 'meilleurs_etudiants',
    };
  }, [students]);

  const getSRExport = useCallback((): ExportTableData => ({
    title: 'Étudiants éligibles Session de Rattrapage',
    columns: ['Nom', 'Matricule', 'Moyenne', 'Nb ECUE < 10', 'ECUEs concernées'],
    rows: srEligible.map(({ student: s, failedECUEs }) => [
      s.name, s.matricule, s.semesterAverage.toFixed(2),
      failedECUEs.length,
      failedECUEs.map(e => `${e.ecueName} (${e.average.toFixed(2)})`).join(', '),
    ]),
    filename: 'eligibles_session_rattrapage',
  }), [srEligible]);

  const getUnapprovedGradesExport = useCallback((): ExportTableData => ({
    title: 'Matières / ECUEs concernés par des notes non approuvées',
    columns: ['UE', 'ECUE', 'Étudiants concernés', 'Occurrences', 'Champs non approuvés'],
    rows: unapprovedSubjects.map(entry => [
      entry.ueName,
      entry.ecueName,
      entry.studentCount,
      entry.occurrenceCount,
      entry.flaggedFields.join(', '),
    ]),
    filename: 'matieres_ecues_notes_non_approuvees',
  }), [unapprovedSubjects]);

  const pieData = [
    { name: 'Admis', value: counts.ADMIS, color: STATUS_COLORS.ADMIS },
    { name: 'Autorisés', value: counts.AUTORISÉ, color: STATUS_COLORS.AUTORISÉ },
    { name: 'Ajournés', value: counts.AJOURNÉ, color: STATUS_COLORS.AJOURNÉ },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {unapprovedEntries.length > 0 && (
        <div className="card-cassie p-4 border-l-[3px]" style={{ borderLeftColor: '#fca665', background: '#fff8f0' }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex p-2 rounded" style={{ background: '#fff0e2', color: '#b86e1d' }}>
                <Info className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#8b4a12' }}>
                  Nous avons constaté une ou plusieurs note(s) ou moyenne(s) non encore approuvée(s).
                </p>
                <p className="text-xs mt-1" style={{ color: '#b86e1d' }}>
                  L’astérisque indique une note ou une moyenne provisoire. {unapprovedEntries.length} occurrence(s) relevée(s) pour {unapprovedStudentCount} étudiant(s). Vous pouvez télécharger la liste des matières/ECUEs ({unapprovedSubjects.length}) concerné(e)s.
                </p>
              </div>
            </div>
            <div className="self-start md:self-auto">
              <ExportButton getData={getUnapprovedGradesExport} />
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <KPICard icon={<Users className="w-5 h-5" />} label="Effectif" value={students.length} color="#5556fd" bg="#f0f0ff" />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Moyenne" value={`${stats.mean}/20`} color="#1e1a70" bg="#e8e8ff" />
        <KPICard icon={<Award className="w-5 h-5" />} label="Admis" value={`${counts.ADMIS} (${pct(counts.ADMIS, students.length)}%)`} color="#22d273" bg="#e6f9ef" />
        <KPICard icon={<ShieldCheck className="w-5 h-5" />} label="Autorisés" value={`${counts.AUTORISÉ} (${pct(counts.AUTORISÉ, students.length)}%)`} color="#d4a017" bg="#fff8e1" />
        <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Ajournés" value={`${counts.AJOURNÉ} (${pct(counts.AJOURNÉ, students.length)}%)`} color="#dc3545" bg="#fce8ea" />
        <KPICard icon={<BookOpen className="w-5 h-5" />} label="Repêchage" value={repechageStudents.length} color="#fca665" bg="#fff5eb" />
        <KPICard icon={<RefreshCw className="w-5 h-5" />} label="Élig. SR" value={`${srEligible.length} (${pct(srEligible.length, students.length)}%)`} color="#7c3aed" bg="#f0e6ff" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          ['Médiane', `${stats.median}/20`],
          ['Écart-type', stats.stddev],
          ['Minimum', `${stats.min}/20`],
          ['Maximum', `${stats.max}/20`],
        ] as const).map(([label, val]) => (
          <div key={label} className="card-cassie p-4 text-center">
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8392a5' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: '#06072d', fontFamily: "'Oswald', sans-serif" }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Donut chart */}
        <div className="card-cassie p-5">
          <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>Répartition des résultats</h6>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0" style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      const name = d.name;
                      const value = d.value as number;
                      const p = pct(value, students.length);
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-lg border" style={{ background: '#fff', borderColor: '#e6e7ef' }}>
                          <span className="font-semibold" style={{ color: '#06072d' }}>{name}</span>
                          <span style={{ color: '#8392a5' }}> — {value} ({p}%)</span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold" style={{ color: '#06072d', fontFamily: "'Oswald', sans-serif" }}>{students.length}</span>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>Total</span>
              </div>
            </div>
            {/* Custom legend */}
            <div className="flex flex-col gap-3">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <div className="text-xs leading-tight">
                    <span className="font-semibold" style={{ color: '#06072d' }}>{d.value}</span>
                    <span style={{ color: '#8392a5' }}> ({pct(d.value, students.length)}%)</span>
                    <span className="block" style={{ color: '#575d78' }}>{d.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* UE Validation rates — clickable to filter ECUE chart */}
        <div className="card-cassie p-5">
          <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>Taux de validation par UE (%)</h6>
          <p className="text-[10px] mb-2" style={{ color: '#8392a5' }}>Cliquez sur une UE pour filtrer les ECUEs</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ueStats} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e7ef" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#8392a5' }} />
              <YAxis type="category" dataKey="ueName" width={130} tick={{ fontSize: 9, fill: '#575d78' }} tickFormatter={shortenUE} />
              <Tooltip formatter={(v) => [`${v}%`, 'Taux']} />
              <Bar
                dataKey="validationRate"
                radius={2}
                onClick={(_data, index) => {
                  const entry = ueStats[index];
                  if (entry) setSelectedUE(selectedUE === entry.ueCode ? null : entry.ueCode);
                }}
                style={{ cursor: 'pointer' }}
              >
                {ueStats.map((entry, i) => {
                  const baseColor = entry.validationRate >= 80 ? '#22d273' : entry.validationRate >= 50 ? '#ffc107' : '#dc3545';
                  const isSelected = selectedUE === entry.ueCode;
                  const isDimmed = selectedUE && !isSelected;
                  return <Cell key={i} fill={baseColor} fillOpacity={isDimmed ? 0.3 : 1} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ECUE averages — filtered by selected UE */}
      <div className="card-cassie overflow-hidden">
        <div
          className="px-5 py-4 flex items-center justify-between cursor-pointer select-none"
          onClick={() => toggle('ecue')}
        >
          <div className="flex items-center gap-2">
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Moyennes par ECUE</h6>
            {selectedUEName && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedUE(null); }}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors"
                style={{ background: '#f0f0ff', color: '#5556fd' }}
              >
                {shortenUE(selectedUEName)}
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {collapsed.ecue ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </div>
        {!collapsed.ecue && <div className="px-5 pb-5">
        <ResponsiveContainer width="100%" height={Math.max(140, filteredECUEStats.length * 35)}>
          <BarChart data={filteredECUEStats} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e7ef" />
            <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11, fill: '#8392a5' }} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 9, fill: '#575d78' }} tickFormatter={s => s.length > 25 ? s.slice(0, 25) + '…' : s} />
            <Tooltip />
            <Bar dataKey="avg" radius={2} label={{ position: 'right', fontSize: 11, formatter: (v: unknown) => typeof v === 'number' ? v.toFixed(1) : '' }}>
              {filteredECUEStats.map((entry, i) => (
                <Cell key={i} fill={entry.avg >= 10 ? '#5556fd' : '#dc3545'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>}
      </div>

      {/* Autorisés list */}
      {autoriseStudents.length > 0 && (
        <div className="card-cassie overflow-hidden" style={{ borderLeft: '3px solid #ffc107' }}>
          <div
            className="px-5 py-4 border-b cursor-pointer select-none"
            style={{ background: '#fffbf0', borderColor: '#fde8a0' }}
            onClick={() => toggle('autorise')}
          >
            <div className="flex items-center justify-between">
              <h6 className="font-medium text-sm flex items-center gap-2" style={{ color: '#b8860b' }}>
                <ShieldCheck className="w-4 h-4" />
                Étudiants autorisés ({autoriseStudents.length})
              </h6>
              <div className="flex items-center gap-2">
                <span onClick={e => e.stopPropagation()}><ExportButton getData={getAutoriseExport} /></span>
                {collapsed.autorise ? <ChevronDown className="w-4 h-4" style={{ color: '#b8860b' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#b8860b' }} />}
              </div>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#c8a44a' }}>
              Moyenne générale ≥ 10/20 mais une ou plusieurs UE non validées
            </p>
          </div>
          {!collapsed.autorise && <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <SortTH table="autorise" k="name" label="Étudiant" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="autorise" k="avg" label="Moy. semestrielle" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="autorise" k="credits" label="Crédits" sorts={sorts} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedAutorise.map(s => (
                  <tr
                    key={s.matricule}
                    className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }}
                    onClick={() => onStudentClick(s)}
                  >
                    <td className="px-5 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: '#d4a017' }}>{s.semesterAverage.toFixed(2)}/20</td>
                    <td className="px-3 py-2.5" style={{ color: '#575d78' }}>{s.totalCredits}/{s.ueResults.reduce((acc, u) => acc + u.totalCredits, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* Repêchage table */}
      {repechageStudents.length > 0 && (
        <div className="card-cassie overflow-hidden" style={{ borderLeft: '3px solid #fca665' }}>
          <div
            className="px-5 py-4 border-b cursor-pointer select-none"
            style={{ background: '#fff8f0', borderColor: '#fde8d0' }}
            onClick={() => toggle('repechage')}
          >
            <div className="flex items-center justify-between">
              <h6 className="font-medium text-sm flex items-center gap-2" style={{ color: '#b86e1d' }}>
                <AlertTriangle className="w-4 h-4" />
                Cas de repêchage potentiels ({repechageStudents.length})
              </h6>
              <div className="flex items-center gap-2">
                <span onClick={e => e.stopPropagation()}><ExportButton getData={getRepechageExport} /></span>
                {collapsed.repechage ? <ChevronDown className="w-4 h-4" style={{ color: '#b86e1d' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#b86e1d' }} />}
              </div>
            </div>
          </div>
          {!collapsed.repechage && <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <SortTH table="repechage" k="name" label="Étudiant" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="repechage" k="credits" label="Crédits" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="repechage" k="avg" label="Moy. semestrielle" sorts={sorts} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>UE concernée</th>
                  <SortTH table="repechage" k="ueAvg" label="Moy. UE" sorts={sorts} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedRepechage.map(s => (
                  <tr
                    key={s.matricule}
                    className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }}
                    onClick={() => onStudentClick(s)}
                  >
                    <td className="px-5 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: '#575d78' }}>{s.totalCredits}/{s.ueResults.reduce((acc, u) => acc + u.totalCredits, 0)}</td>
                    <td className="px-3 py-2.5" style={{ color: '#575d78' }}>{s.semesterAverage.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#575d78' }}>
                      {s.ueResults.find(u => u.ueCode === s.repechageUECode)?.ueName ?? s.repechageUECode}
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: '#b86e1d' }}>
                      {s.repechageUEAvg?.toFixed(2)}/20
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* SR Eligible students */}
      {srEligible.length > 0 && (
        <div className="card-cassie overflow-hidden" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div
            className="px-5 py-4 border-b cursor-pointer select-none"
            style={{ background: '#f8f0ff', borderColor: '#e4d0ff' }}
            onClick={() => toggle('sr')}
          >
            <div className="flex items-center justify-between">
              <h6 className="font-medium text-sm flex items-center gap-2" style={{ color: '#7c3aed' }}>
                <RefreshCw className="w-4 h-4" />
                Éligibles Session de Rattrapage ({srEligible.length})
              </h6>
              <div className="flex items-center gap-2">
                <span onClick={e => e.stopPropagation()}><ExportButton getData={getSRExport} /></span>
                {collapsed.sr ? <ChevronDown className="w-4 h-4" style={{ color: '#7c3aed' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#7c3aed' }} />}
              </div>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#9775cd' }}>
              Étudiants ayant au moins une ECUE avec une moyenne &lt; 10/20
            </p>
          </div>
          {!collapsed.sr && <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <SortTH table="sr" k="name" label="Étudiant" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="sr" k="avg" label="Moyenne" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="sr" k="count" label="ECUE < 10" sorts={sorts} onSort={toggleSort} center />
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>ECUEs concernées</th>
                </tr>
              </thead>
              <tbody>
                {sortedSR.map(({ student: s, failedECUEs }) => (
                  <tr
                    key={s.matricule}
                    className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }}
                    onClick={() => onStudentClick(s)}
                  >
                    <td className="px-5 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: s.semesterAverage >= 10 ? '#22d273' : '#dc3545' }}>
                      {s.semesterAverage.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: '#f0e6ff', color: '#7c3aed' }}>
                        {failedECUEs.length}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {failedECUEs.slice(0, 3).map((e, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#fce8ea', color: '#dc3545' }}>
                            {e.ecueName.length > 25 ? e.ecueName.slice(0, 25) + '…' : e.ecueName} ({e.average.toFixed(2)})
                          </span>
                        ))}
                        {failedECUEs.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#f3f6f9', color: '#8392a5' }}>
                            +{failedECUEs.length - 3} autres
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* Top 5 students */}
      <div className="card-cassie overflow-hidden">
        <div
          className="px-5 py-4 border-b flex items-center justify-between cursor-pointer select-none"
          style={{ borderColor: '#e6e7ef' }}
          onClick={() => toggle('top')}
        >
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Meilleurs étudiants</h6>
          <div className="flex items-center gap-2">
            <span onClick={e => e.stopPropagation()}><ExportButton getData={getTopStudentsExport} /></span>
            {collapsed.top ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
          </div>
        </div>
        {!collapsed.top && <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Rang</th>
                <SortTH table="top" k="name" label="Étudiant" sorts={sorts} onSort={toggleSort} />
                <SortTH table="top" k="avg" label="Moyenne" sorts={sorts} onSort={toggleSort} />
                <SortTH table="top" k="credits" label="Crédits" sorts={sorts} onSort={toggleSort} />
                <SortTH table="top" k="status" label="Statut" sorts={sorts} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {topStudents
                .map((s, i) => (
                  <tr key={s.matricule} className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }} onClick={() => onStudentClick(s)}>
                    <td className="px-5 py-2.5 font-bold" style={{ color: '#c0ccda' }}>#{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: '#5556fd' }}>{s.semesterAverage.toFixed(2)}</td>
                    <td className="px-3 py-2.5" style={{ color: '#575d78' }}>{s.totalCredits}/{s.ueResults.reduce((acc, u) => acc + u.totalCredits, 0)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="card-cassie p-4">
      <div className="inline-flex p-2 rounded mb-2" style={{ background: bg, color }}>{icon}</div>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: '#06072d' }}>{value}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    ADMIS: { bg: '#e6f9ef', color: '#22d273' },
    AUTORISÉ: { bg: '#fff8e1', color: '#d4a017' },
    AJOURNÉ: { bg: '#fce8ea', color: '#dc3545' },
  };
  const s = styles[status] ?? { bg: '#f3f6f9', color: '#637382' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function SortTH({ table, k, label, sorts, onSort, center }: {
  table: string; k: string; label: string;
  sorts: Record<string, { key: string; dir: 'asc' | 'desc' }>;
  onSort: (table: string, key: string) => void;
  center?: boolean;
}) {
  const active = sorts[table]?.key === k;
  const dir = sorts[table]?.dir;
  return (
    <th
      className={`px-3 py-2 text-xs font-medium cursor-pointer select-none hover:text-[#06072d] ${center ? 'text-center' : 'text-left'}`}
      style={{ color: active ? '#5556fd' : '#8392a5' }}
      onClick={() => onSort(table, k)}
    >
      <div className={`flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
          : <ChevronDown className="w-3 h-3 opacity-30" />}
      </div>
    </th>
  );
}

function shortenUE(name: string) {
  return name.replace('COMMUNICATION ET LANGUE', 'COM. & LANGUE')
    .replace('ECONOMIE ET GESTION DES ENTREPRISES', 'ÉCON. & GESTION')
    .replace('OUTILS ET ECONOMIE NUMERIQUES', 'OUTILS NUM.')
    .replace('MATHEMATIQUES ET STATISTIQUE', 'MATHS & STAT.')
    .replace(/\s+\d$/, '');
}
