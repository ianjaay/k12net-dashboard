import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer,
} from 'recharts';
import { Users, TrendingUp, Award, AlertTriangle, ChevronDown, ChevronUp, XCircle, Bell } from 'lucide-react';
import type { K12Student, TermView, TermId } from '../types/k12';
import { computeClassStats } from '../utils/k12RulesEngine';
import { computePeriodStats, calculateDelta, generateAllAlerts } from '../utils/analyticsCalculations';
import type { DeltaResult } from '../types/analytics';
import MetricCard, { DeltaBadge } from './MetricCard';
import ExportButton from './ExportButton';
import type { ExportTableData } from '../utils/exportTable';

interface Props {
  students: K12Student[];
  termView: TermView;
  onTermViewChange: (v: TermView) => void;
  onStudentClick: (student: K12Student) => void;
}

const STATUS_COLORS = { ADMIS: '#22d273', REDOUBLE: '#ffc107', EXCLU: '#dc3545' };

export default function Dashboard({ students, termView, onTermViewChange, onStudentClick }: Props) {
  const stats = useMemo(() => computeClassStats(students), [students]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  type SortDir = 'asc' | 'desc';
  const [sorts, setSorts] = useState<Record<string, { key: string; dir: SortDir }>>({});
  const toggleSort = (table: string, key: string) => {
    setSorts(prev => {
      const cur = prev[table];
      if (cur?.key === key) return { ...prev, [table]: { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      return { ...prev, [table]: { key, dir: 'desc' } };
    });
  };

  const topStudents = useMemo(() => {
    const withAvg = students
      .filter(s => s.yearResult?.yearAverage != null)
      .sort((a, b) => (b.yearResult!.yearAverage ?? 0) - (a.yearResult!.yearAverage ?? 0))
      .slice(0, 5);
    const s = sorts.top;
    if (!s) return withAvg;
    return [...withAvg].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (s.key === 'name') { va = a.fullName.toLowerCase(); vb = b.fullName.toLowerCase(); }
      else if (s.key === 'avg') { va = a.yearResult?.yearAverage ?? 0; vb = b.yearResult?.yearAverage ?? 0; }
      else if (s.key === 'status') { va = a.yearResult?.promotionStatus ?? ''; vb = b.yearResult?.promotionStatus ?? ''; }
      if (va < vb) return s.dir === 'asc' ? -1 : 1;
      if (va > vb) return s.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, sorts.top]);

  const distinctionData = useMemo(() => {
    if (termView !== 'ANNUAL') {
      const ts = stats.termStats[termView as 'T1' | 'T2' | 'T3'];
      if (!ts) return [];
      return [
        { name: 'THF', value: ts.distinctions.THF, color: '#22d273' },
        { name: 'THFR', value: ts.distinctions.THFR, color: '#86efac' },
        { name: 'THE', value: ts.distinctions.THE, color: '#5556fd' },
        { name: 'THER', value: ts.distinctions.THER, color: '#a5b4fc' },
        { name: 'TH', value: ts.distinctions.TH, color: '#ffc107' },
        { name: 'THR', value: ts.distinctions.THR, color: '#fde68a' },
      ].filter(d => d.value > 0);
    }
    const totals = { THF: 0, THFR: 0, THE: 0, THER: 0, TH: 0, THR: 0 };
    for (const tid of ['T1', 'T2', 'T3'] as const) {
      const ts = stats.termStats[tid];
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += ts.distinctions[k];
    }
    return [
      { name: 'THF', value: totals.THF, color: '#22d273' },
      { name: 'THFR', value: totals.THFR, color: '#86efac' },
      { name: 'THE', value: totals.THE, color: '#5556fd' },
      { name: 'THER', value: totals.THER, color: '#a5b4fc' },
      { name: 'TH', value: totals.TH, color: '#ffc107' },
      { name: 'THR', value: totals.THR, color: '#fde68a' },
    ].filter(d => d.value > 0);
  }, [stats, termView]);

  const sanctionData = useMemo(() => {
    if (termView !== 'ANNUAL') {
      const ts = stats.termStats[termView as 'T1' | 'T2' | 'T3'];
      if (!ts) return [];
      return [
        { name: 'BTI', value: ts.sanctions.BTI, color: '#dc3545' },
        { name: 'AVT', value: ts.sanctions.AVT, color: '#fca665' },
        { name: 'BMC', value: ts.sanctions.BMC, color: '#7c3aed' },
        { name: 'AMC', value: ts.sanctions.AMC, color: '#c084fc' },
      ].filter(d => d.value > 0);
    }
    const totals = { BTI: 0, AVT: 0, BMC: 0, AMC: 0 };
    for (const tid of ['T1', 'T2', 'T3'] as const) {
      const ts = stats.termStats[tid];
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += ts.sanctions[k];
    }
    return [
      { name: 'BTI', value: totals.BTI, color: '#dc3545' },
      { name: 'AVT', value: totals.AVT, color: '#fca665' },
      { name: 'BMC', value: totals.BMC, color: '#7c3aed' },
      { name: 'AMC', value: totals.AMC, color: '#c084fc' },
    ].filter(d => d.value > 0);
  }, [stats, termView]);

  const pieData = [
    { name: 'Admis', value: stats.promoted, color: STATUS_COLORS.ADMIS },
    { name: 'Redouble', value: stats.retained, color: STATUS_COLORS.REDOUBLE },
    { name: 'Exclu', value: stats.expelled, color: STATUS_COLORS.EXCLU },
  ].filter(d => d.value > 0);

  const getTopStudentsExport = useCallback((): ExportTableData => {
    const top = [...students]
      .filter(s => s.yearResult?.yearAverage != null)
      .sort((a, b) => (b.yearResult!.yearAverage ?? 0) - (a.yearResult!.yearAverage ?? 0))
      .slice(0, 5);
    return {
      title: 'Meilleurs élèves',
      columns: ['Rang', 'Nom', 'Matricule', 'Moyenne annuelle', 'Statut'],
      rows: top.map((s, i) => [
        `#${i + 1}`, s.fullName, s.matricule,
        s.yearResult?.yearAverage?.toFixed(2) ?? '—',
        s.yearResult?.promotionStatus ?? '—',
      ]),
      filename: 'meilleurs_eleves',
    };
  }, [students]);

  const periodMoyenne = useMemo(() => {
    if (termView === 'ANNUAL') return stats.averageClassGrade;
    return stats.termStats[termView as 'T1' | 'T2' | 'T3']?.averageGrade ?? null;
  }, [stats, termView]);

  // ── Period stats with deltas ──
  const periodStats = useMemo(() => computePeriodStats(students, termView === 'ANNUAL' ? 'ANNUAL' : termView), [students, termView]);

  const prevStats = useMemo(() => {
    if (termView === 'ANNUAL' || termView === 'T1') return [];
    const refs: { tid: TermId; stats: ReturnType<typeof computePeriodStats> }[] = [];
    if (termView === 'T2') {
      refs.push({ tid: 'T1', stats: computePeriodStats(students, 'T1') });
    } else if (termView === 'T3') {
      refs.push({ tid: 'T2', stats: computePeriodStats(students, 'T2') });
      refs.push({ tid: 'T1', stats: computePeriodStats(students, 'T1') });
    }
    return refs;
  }, [students, termView]);

  function buildDeltas(current: number | null, field: 'mean' | 'median' | 'stddev' | 'min' | 'max' | 'range' | 'q1' | 'q3'): { delta: DeltaResult; format?: 'number'; invertColor?: boolean }[] {
    return prevStats
      .map(p => {
        const d = calculateDelta(current, p.stats[field], p.tid);
        return d ? { delta: d, invertColor: field === 'stddev' } : null;
      })
      .filter((d): d is { delta: DeltaResult; invertColor: boolean } => d !== null);
  }

  // ── Alerts ──
  const alerts = useMemo(() => {
    if (termView === 'ANNUAL' || termView === 'T1') return [];
    return generateAllAlerts(students, termView as TermId);
  }, [students, termView]);

  const alertCounts = useMemo(() => {
    const counts = { danger: 0, warning: 0, success: 0, info: 0 };
    for (const a of alerts) counts[a.severity]++;
    return counts;
  }, [alerts]);

  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <div className="space-y-5">
      {/* Term view toggle */}
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

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="card-cassie overflow-hidden">
          <div
            className="px-5 py-3 flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4" style={{ color: '#5556fd' }} />
              <span className="text-sm font-medium" style={{ color: '#06072d' }}>Alertes</span>
              <div className="flex gap-1.5">
                {alertCounts.danger > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fce8ea', color: '#dc3545' }}>{alertCounts.danger}</span>}
                {alertCounts.warning > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fff8e1', color: '#d4a017' }}>{alertCounts.warning}</span>}
                {alertCounts.success > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#e6f9ef', color: '#22d273' }}>{alertCounts.success}</span>}
                {alertCounts.info > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#dbeafe', color: '#2563eb' }}>{alertCounts.info}</span>}
              </div>
            </div>
            {showAlerts ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
          </div>
          {showAlerts && (
            <div className="px-5 pb-4 space-y-1.5 max-h-60 overflow-y-auto">
              {alerts.slice(0, 30).map((a, i) => {
                const sc: Record<string, { bg: string; color: string; border: string }> = {
                  danger: { bg: '#fce8ea', color: '#dc3545', border: '#f5c6cb' },
                  warning: { bg: '#fff8e1', color: '#856404', border: '#ffeeba' },
                  success: { bg: '#e6f9ef', color: '#166534', border: '#c3e6cb' },
                  info: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
                };
                const s = sc[a.severity];
                return (
                  <div key={i} className="text-[11px] px-3 py-1.5 rounded border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
                    {a.message}
                  </div>
                );
              })}
              {alerts.length > 30 && <p className="text-[10px] text-center" style={{ color: '#8392a5' }}>+{alerts.length - 30} alertes</p>}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard icon={<Users className="w-5 h-5" />} label="Effectif" value={students.length} color="#5556fd" bg="#f0f0ff" />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5" />} label="Moyenne"
          value={periodMoyenne != null ? periodMoyenne.toFixed(2) : '—'} suffix="/20"
          color="#1e1a70" bg="#e8e8ff"
          deltas={buildDeltas(periodStats.mean, 'mean')}
        />
        <MetricCard icon={<Award className="w-5 h-5" />} label="Admis" value={`${stats.promoted} (${pct(stats.promoted, students.length)}%)`} color="#22d273" bg="#e6f9ef" />
        <MetricCard icon={<AlertTriangle className="w-5 h-5" />} label="Redouble" value={`${stats.retained} (${pct(stats.retained, students.length)}%)`} color="#d4a017" bg="#fff8e1" />
        <MetricCard icon={<XCircle className="w-5 h-5" />} label="Exclu" value={`${stats.expelled} (${pct(stats.expelled, students.length)}%)`} color="#dc3545" bg="#fce8ea" />
      </div>

      {/* Stats row with deltas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Médiane" value={periodStats.median?.toFixed(2) ?? '—'} suffix="/20" deltas={buildDeltas(periodStats.median, 'median')} />
        <MetricCard label="Écart-type" value={periodStats.stddev?.toFixed(2) ?? '—'} deltas={buildDeltas(periodStats.stddev, 'stddev')} />
        <MetricCard label="Minimum" value={periodStats.min?.toFixed(2) ?? '—'} suffix="/20" deltas={buildDeltas(periodStats.min, 'min')} />
        <MetricCard label="Maximum" value={periodStats.max?.toFixed(2) ?? '—'} suffix="/20" deltas={buildDeltas(periodStats.max, 'max')} />
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
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div className="rounded-lg px-3 py-2 text-xs shadow-lg border" style={{ background: '#fff', borderColor: '#e6e7ef' }}>
                        <span className="font-semibold" style={{ color: '#06072d' }}>{d.name}</span>
                        <span style={{ color: '#8392a5' }}> — {d.value as number} ({pct(d.value as number, students.length)}%)</span>
                      </div>
                    );
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold" style={{ color: '#06072d', fontFamily: "'Oswald', sans-serif" }}>{students.length}</span>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>Total</span>
              </div>
            </div>
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

        {/* Distinctions bar chart */}
        <div className="card-cassie p-5">
          <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>
            Distinctions {termView !== 'ANNUAL' ? `(${termView})` : '(cumul annuel)'}
          </h6>
          {distinctionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distinctionData} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e7ef" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#575d78' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8392a5' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11 }}>
                  {distinctionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-center py-10" style={{ color: '#c0ccda' }}>Aucune distinction</p>
          )}
        </div>
      </div>

      {/* Sanctions */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between cursor-pointer select-none" onClick={() => toggle('sanctions')}>
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>
            Sanctions {termView !== 'ANNUAL' ? `(${termView})` : '(cumul annuel)'}
          </h6>
          {collapsed.sanctions ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </div>
        {!collapsed.sanctions && (
          <div className="px-5 pb-5">
            {sanctionData.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sanctionData.map(d => (
                  <div key={d.name} className="p-3 rounded text-center" style={{ background: d.color + '15' }}>
                    <p className="text-2xl font-bold" style={{ color: d.color }}>{d.value}</p>
                    <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: d.color }}>{d.name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#8392a5' }}>{sanctionLabels[d.name]}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-4" style={{ color: '#c0ccda' }}>Aucune sanction</p>
            )}
          </div>
        )}
      </div>

      {/* Term averages */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between cursor-pointer select-none" onClick={() => toggle('termAvg')}>
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Moyennes par trimestre</h6>
          {collapsed.termAvg ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </div>
        {!collapsed.termAvg && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-4">
              {(['T1', 'T2', 'T3'] as const).map(tid => {
                const ts = stats.termStats[tid];
                return (
                  <div key={tid} className="p-4 rounded text-center" style={{ background: '#f9f9fd' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8392a5' }}>{tid}</p>
                    <p className="text-2xl font-bold" style={{ color: '#06072d', fontFamily: "'Oswald', sans-serif" }}>
                      {ts.averageGrade != null ? `${ts.averageGrade.toFixed(2)}` : '—'}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: '#8392a5' }}>/20</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top 5 */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between cursor-pointer select-none" style={{ borderColor: '#e6e7ef' }} onClick={() => toggle('top')}>
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Meilleurs élèves</h6>
          <div className="flex items-center gap-2">
            <span onClick={e => e.stopPropagation()}><ExportButton getData={getTopStudentsExport} /></span>
            {collapsed.top ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
          </div>
        </div>
        {!collapsed.top && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Rang</th>
                  <SortTH table="top" k="name" label="Élève" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="top" k="avg" label="Moy. Annuelle" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="top" k="status" label="Statut" sorts={sorts} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {topStudents.map((s, i) => (
                  <tr key={s.matricule} className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }} onClick={() => onStudentClick(s)}>
                    <td className="px-5 py-2.5 font-bold" style={{ color: '#c0ccda' }}>#{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.fullName}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>{s.matricule}</div>
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: '#5556fd' }}>
                      {s.yearResult?.yearAverage?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5"><PromotionBadge status={s.yearResult?.promotionStatus ?? null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function PromotionBadge({ status }: { status: string | null }) {
  const styles: Record<string, { bg: string; color: string }> = {
    ADMIS: { bg: '#e6f9ef', color: '#22d273' },
    REDOUBLE: { bg: '#fff8e1', color: '#d4a017' },
    EXCLU: { bg: '#fce8ea', color: '#dc3545' },
  };
  const label = status ?? '—';
  const s = styles[label] ?? { bg: '#f3f6f9', color: '#637382' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

export function DistinctionBadge({ distinction }: { distinction: string | null }) {
  if (!distinction) return null;
  const colors: Record<string, { bg: string; color: string }> = {
    THF: { bg: '#e6f9ef', color: '#22d273' },
    THFR: { bg: '#e6f9ef', color: '#86efac' },
    THE: { bg: '#f0f0ff', color: '#5556fd' },
    THER: { bg: '#f0f0ff', color: '#a5b4fc' },
    TH: { bg: '#fff8e1', color: '#d4a017' },
    THR: { bg: '#fff8e1', color: '#c8a44a' },
  };
  const s = colors[distinction] ?? { bg: '#f3f6f9', color: '#637382' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {distinction}
    </span>
  );
}

export function SanctionBadge({ sanction }: { sanction: string | null }) {
  if (!sanction) return null;
  const colors: Record<string, { bg: string; color: string }> = {
    BTI: { bg: '#fce8ea', color: '#dc3545' },
    AVT: { bg: '#fff5eb', color: '#fca665' },
    BMC: { bg: '#f0e6ff', color: '#7c3aed' },
    AMC: { bg: '#f0e6ff', color: '#c084fc' },
  };
  const s = colors[sanction] ?? { bg: '#f3f6f9', color: '#637382' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {sanction}
    </span>
  );
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function SortTH({ table, k, label, sorts, onSort }: {
  table: string; k: string; label: string;
  sorts: Record<string, { key: string; dir: 'asc' | 'desc' }>;
  onSort: (table: string, key: string) => void;
}) {
  const active = sorts[table]?.key === k;
  const dir = sorts[table]?.dir;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium cursor-pointer select-none hover:text-[#06072d]"
      style={{ color: active ? '#5556fd' : '#8392a5' }}
      onClick={() => onSort(table, k)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
          : <ChevronDown className="w-3 h-3 opacity-30" />}
      </div>
    </th>
  );
}

const sanctionLabels: Record<string, string> = {
  BTI: 'Blâme travail insuffisant',
  AVT: 'Avertissement travail',
  BMC: 'Blâme mauvaise conduite',
  AMC: 'Avertissement conduite',
};
