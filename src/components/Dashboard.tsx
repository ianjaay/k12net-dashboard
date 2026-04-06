import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import { Users, TrendingUp, Award, AlertTriangle, ChevronDown, ChevronUp, XCircle, Bell, Maximize2, X } from 'lucide-react';
import type { K12Student, TermView, TermId, TermDistinction, TermSanction } from '../types/k12';
import { getGradeLevelGroup } from '../types/k12';
import { computeClassStats, BUILTIN_RULES } from '../utils/k12RulesEngine';
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

  const [expandedCard, setExpandedCard] = useState<'distinctions' | 'sanctions' | 'radar' | 'etendue' | null>(null);

  const [topCount, setTopCount] = useState(5);
  const [bottomCount, setBottomCount] = useState(5);
  const [topThreshold, setTopThreshold] = useState<number | null>(null);
  const [bottomThreshold, setBottomThreshold] = useState<number | null>(null);

  type SortDir = 'asc' | 'desc';
  const [sorts, setSorts] = useState<Record<string, { key: string; dir: SortDir }>>({});
  const toggleSort = (table: string, key: string) => {
    setSorts(prev => {
      const cur = prev[table];
      if (cur?.key === key) return { ...prev, [table]: { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      return { ...prev, [table]: { key, dir: 'desc' } };
    });
  };

  const getStudentAvg = useCallback((s: K12Student): number | null => {
    if (termView === 'ANNUAL') return s.yearResult?.yearAverage ?? null;
    const tr = s.yearResult?.termResults.find(t => t.termId === termView);
    return tr?.termAverage ?? null;
  }, [termView]);

  const getStudentDistinction = useCallback((s: K12Student): TermDistinction => {
    if (termView !== 'ANNUAL') {
      const tr = s.yearResult?.termResults.find(t => t.termId === termView);
      return tr?.distinction ?? null;
    }
    const avg = s.yearResult?.yearAverage;
    if (avg == null) return null;
    const config = BUILTIN_RULES['2024'];
    const group = getGradeLevelGroup(s.gradeLevel);
    const th = config.termDistinction[group];
    const thMax = th.thMax ?? th.theMin;
    const theMax = th.theMax ?? th.thfMin;
    const hasReserve = s.yearResult?.termResults.some(tr =>
      tr.distinction === 'THR' || tr.distinction === 'THER' || tr.distinction === 'THFR'
    ) ?? false;
    if (avg >= th.thfMin) return hasReserve ? 'THFR' : 'THF';
    if (avg >= th.theMin && avg < theMax) return hasReserve ? 'THER' : 'THE';
    if (avg >= th.thMin && avg < thMax) return hasReserve ? 'THR' : 'TH';
    return null;
  }, [termView]);

  const getStudentSanction = useCallback((s: K12Student): TermSanction => {
    if (termView !== 'ANNUAL') {
      const tr = s.yearResult?.termResults.find(t => t.termId === termView);
      return tr?.sanction ?? null;
    }
    const avg = s.yearResult?.yearAverage;
    if (avg == null) return null;
    const config = BUILTIN_RULES['2024'];
    if (avg < config.termSanction.btiMax) return 'BTI';
    if (avg < config.termSanction.avtMax) return 'AVT';
    const hasBMC = s.yearResult?.termResults.some(tr => tr.sanction === 'BMC');
    if (hasBMC) return 'BMC';
    const hasAMC = s.yearResult?.termResults.some(tr => tr.sanction === 'AMC');
    if (hasAMC) return 'AMC';
    return null;
  }, [termView]);

  const studentsWithAvg = useMemo(() =>
    students
      .filter(s => getStudentAvg(s) != null)
      .sort((a, b) => (getStudentAvg(b) ?? 0) - (getStudentAvg(a) ?? 0)),
  [students, getStudentAvg]);

  const applySorts = (list: K12Student[], table: string) => {
    const s = sorts[table];
    if (!s) return list;
    return [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (s.key === 'name') { va = a.fullName.toLowerCase(); vb = b.fullName.toLowerCase(); }
      else if (s.key === 'avg') { va = getStudentAvg(a) ?? 0; vb = getStudentAvg(b) ?? 0; }
      else if (s.key === 'status') { va = a.yearResult?.promotionStatus ?? ''; vb = b.yearResult?.promotionStatus ?? ''; }
      if (va < vb) return s.dir === 'asc' ? -1 : 1;
      if (va > vb) return s.dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const topStudents = useMemo(() => {
    const base = topThreshold != null
      ? studentsWithAvg.filter(s => {
          const avg = getStudentAvg(s);
          return avg != null && avg >= topThreshold;
        })
      : studentsWithAvg.slice(0, topCount);
    return applySorts(base, 'top');
  }, [studentsWithAvg, topCount, topThreshold, sorts.top, getStudentAvg]);

  const bottomStudents = useMemo(() => {
    const reversed = [...studentsWithAvg].reverse();
    const base = bottomThreshold != null
      ? reversed.filter(s => {
          const avg = getStudentAvg(s);
          return avg != null && avg < bottomThreshold;
        })
      : reversed.slice(0, bottomCount);
    return applySorts(base, 'bottom');
  }, [studentsWithAvg, bottomCount, bottomThreshold, sorts.bottom, getStudentAvg]);

  const distinctionData = useMemo(() => {
    const ts = termView === 'ANNUAL'
      ? stats.annualStats
      : stats.termStats[termView as 'T1' | 'T2' | 'T3'];
    if (!ts) return [];
    return [
      { name: 'THF', value: ts.distinctions.THF, color: '#22d273' },
      { name: 'THFR', value: ts.distinctions.THFR, color: '#86efac' },
      { name: 'THE', value: ts.distinctions.THE, color: '#5556fd' },
      { name: 'THER', value: ts.distinctions.THER, color: '#a5b4fc' },
      { name: 'TH', value: ts.distinctions.TH, color: '#ffc107' },
      { name: 'THR', value: ts.distinctions.THR, color: '#fde68a' },
    ].filter(d => d.value > 0);
  }, [stats, termView]);

  const sanctionData = useMemo(() => {
    const ts = termView === 'ANNUAL'
      ? stats.annualStats
      : stats.termStats[termView as 'T1' | 'T2' | 'T3'];
    if (!ts) return [];
    return [
      { name: 'BTI', value: ts.sanctions.BTI, color: '#dc3545' },
      { name: 'AVT', value: ts.sanctions.AVT, color: '#fca665' },
      { name: 'BMC', value: ts.sanctions.BMC, color: '#7c3aed' },
      { name: 'AMC', value: ts.sanctions.AMC, color: '#c084fc' },
    ].filter(d => d.value > 0);
  }, [stats, termView]);

  const pieData = [
    { name: 'Admis', value: stats.promoted, color: STATUS_COLORS.ADMIS },
    { name: 'Redouble', value: stats.retained, color: STATUS_COLORS.REDOUBLE },
    { name: 'Exclu', value: stats.expelled, color: STATUS_COLORS.EXCLU },
  ].filter(d => d.value > 0);

  const radarData = useMemo(() => {
    // Collect all distinct subject codes across students
    const subjectMap = new Map<string, { code: string; name: string }>();
    for (const s of students) {
      for (const sg of s.subjectGrades) {
        if (sg.coefficient > 0 && !subjectMap.has(sg.subjectCode)) {
          subjectMap.set(sg.subjectCode, { code: sg.subjectCode, name: sg.subjectName });
        }
      }
    }

    return Array.from(subjectMap.values()).map(({ code, name }) => {
      const avgs: number[] = [];
      for (const s of students) {
        const sg = s.subjectGrades.find(g => g.subjectCode === code);
        if (!sg) continue;
        let avg: number | null = null;
        if (termView === 'ANNUAL') {
          // Average across available terms
          const termAvgs = (['T1', 'T2', 'T3'] as const)
            .map(t => sg.terms[t]?.average)
            .filter((v): v is number => v != null);
          avg = termAvgs.length > 0 ? termAvgs.reduce((a, b) => a + b, 0) / termAvgs.length : null;
        } else {
          avg = sg.terms[termView as 'T1' | 'T2' | 'T3']?.average ?? null;
        }
        if (avg != null) avgs.push(avg);
      }
      if (avgs.length === 0) return null;
      const classAvg = Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100;
      const maxAvg = Math.round(Math.max(...avgs) * 100) / 100;
      const minAvg = Math.round(Math.min(...avgs) * 100) / 100;
      const shortName = name.length > 14 ? name.substring(0, 13) + '…' : name;
      return { subject: shortName, fullName: name, moyenne: classAvg, max: maxAvg, min: minAvg };
    }).filter(Boolean) as { subject: string; fullName: string; moyenne: number; max: number; min: number }[];
  }, [students, termView]);

  const rangeData = useMemo(() =>
    radarData.map(d => ({
      subject: d.subject,
      fullName: d.fullName,
      range: [d.min, d.max] as [number, number],
      avg: [d.moyenne - 0.15, d.moyenne + 0.15] as [number, number],
      min: d.min,
      max: d.max,
      moyenne: d.moyenne,
    })),
  [radarData]);

  const disciplineStats = useMemo(() => {
    const subjectMap = new Map<string, { code: string; name: string }>();
    for (const s of students) {
      for (const sg of s.subjectGrades) {
        if (sg.coefficient > 0 && !subjectMap.has(sg.subjectCode)) {
          subjectMap.set(sg.subjectCode, { code: sg.subjectCode, name: sg.subjectName });
        }
      }
    }

    return Array.from(subjectMap.values()).map(({ code, name }) => {
      const avgs: number[] = [];
      for (const s of students) {
        const sg = s.subjectGrades.find(g => g.subjectCode === code);
        if (!sg) continue;
        let avg: number | null = null;
        if (termView === 'ANNUAL') {
          const termAvgs = (['T1', 'T2', 'T3'] as const)
            .map(t => sg.terms[t]?.average)
            .filter((v): v is number => v != null);
          avg = termAvgs.length > 0 ? termAvgs.reduce((a, b) => a + b, 0) / termAvgs.length : null;
        } else {
          avg = sg.terms[termView as 'T1' | 'T2' | 'T3']?.average ?? null;
        }
        if (avg != null) avgs.push(avg);
      }
      if (avgs.length === 0) return null;
      const eff = avgs.length;
      const moy = avgs.reduce((a, b) => a + b, 0) / eff;
      const min = Math.min(...avgs);
      const max = Math.max(...avgs);
      const lt85 = avgs.filter(a => a < 8.5).length;
      const mid = avgs.filter(a => a >= 8.5 && a < 10).length;
      const gte10 = avgs.filter(a => a >= 10).length;
      const pct10 = Math.round((gte10 / eff) * 100);
      const app = pct10 >= 95 ? 'Excellent' : pct10 >= 80 ? 'Bien' : pct10 >= 60 ? 'Assez Bien' : pct10 >= 40 ? 'Passable' : 'Insuffisant';
      return { disc: name, eff, moy, min, max, lt85, mid, gte10, pct10, app };
    }).filter(Boolean) as { disc: string; eff: number; moy: number; min: number; max: number; lt85: number; mid: number; gte10: number; pct10: number; app: string }[];
  }, [students, termView]);

  const periodLabel = termView === 'ANNUAL' ? 'annuelle' : termView;

  const getTopStudentsExport = useCallback((): ExportTableData => {
    const list = topThreshold != null
      ? studentsWithAvg.filter(s => {
          const avg = getStudentAvg(s);
          return avg != null && avg >= topThreshold;
        })
      : studentsWithAvg.slice(0, topCount);
    const thLabel = topThreshold != null ? ` | seuil ≥${topThreshold}` : '';
    return {
      title: `Meilleurs ${topThreshold != null ? list.length : topCount} élèves (${periodLabel}${thLabel})`,
      columns: ['Rang', 'Nom', 'Matricule', `Moyenne ${periodLabel}`, 'Distinction', 'Sanction', 'Statut'],
      rows: list.map((s, i) => [
        `#${i + 1}`, s.fullName, s.matricule,
        getStudentAvg(s)?.toFixed(2) ?? '—',
        getStudentDistinction(s) ?? '—',
        getStudentSanction(s) ?? '—',
        s.yearResult?.promotionStatus ?? '—',
      ]),
      filename: 'meilleurs_eleves',
    };
  }, [studentsWithAvg, topCount, topThreshold, getStudentAvg, getStudentDistinction, getStudentSanction, periodLabel]);

  const getBottomStudentsExport = useCallback((): ExportTableData => {
    const reversed = [...studentsWithAvg].reverse();
    const list = bottomThreshold != null
      ? reversed.filter(s => {
          const avg = getStudentAvg(s);
          return avg != null && avg < bottomThreshold;
        })
      : reversed.slice(0, bottomCount);
    const thLabel = bottomThreshold != null ? ` | seuil <${bottomThreshold}` : '';
    return {
      title: `${bottomThreshold != null ? list.length : bottomCount} élèves les plus faibles (${periodLabel}${thLabel})`,
      columns: ['Rang', 'Nom', 'Matricule', `Moyenne ${periodLabel}`, 'Distinction', 'Sanction', 'Statut'],
      rows: list.map((s, i) => [
        `#${i + 1}`, s.fullName, s.matricule,
        getStudentAvg(s)?.toFixed(2) ?? '—',
        getStudentDistinction(s) ?? '—',
        getStudentSanction(s) ?? '—',
        s.yearResult?.promotionStatus ?? '—',
      ]),
      filename: 'eleves_plus_faibles',
    };
  }, [studentsWithAvg, bottomCount, bottomThreshold, getStudentAvg, getStudentDistinction, getStudentSanction, periodLabel]);

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
  const [alertFilter, setAlertFilter] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    if (!alertFilter) return alerts;
    return alerts.filter(a => a.severity === alertFilter);
  }, [alerts, alertFilter]);

  const getAlertsExport = useCallback((): ExportTableData => {
    const severityLabel: Record<string, string> = { danger: 'Danger', warning: 'Avertissement', success: 'Succès', info: 'Info' };
    const source = alertFilter ? filteredAlerts : alerts;
    return {
      title: `Alertes${alertFilter ? ` (${severityLabel[alertFilter] ?? alertFilter})` : ''} — ${termView === 'ANNUAL' ? 'Annuel' : termView}`,
      columns: ['#', 'Sévérité', 'Message'],
      rows: source.map((a, i) => [
        String(i + 1),
        severityLabel[a.severity] ?? a.severity,
        a.message,
      ]),
      filename: 'alertes',
    };
  }, [alerts, filteredAlerts, alertFilter, termView]);

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
              <span className="text-sm font-medium" style={{ color: '#06072d' }}>Tendances de Progression/Regression</span>
              <div className="flex gap-1.5">
                {alertCounts.danger > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-opacity" style={{ background: '#fce8ea', color: '#dc3545', opacity: alertFilter && alertFilter !== 'danger' ? 0.4 : 1 }} onClick={e => { e.stopPropagation(); setAlertFilter(alertFilter === 'danger' ? null : 'danger'); setShowAlerts(true); }}>{alertCounts.danger}</span>}
                {alertCounts.warning > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-opacity" style={{ background: '#fff8e1', color: '#d4a017', opacity: alertFilter && alertFilter !== 'warning' ? 0.4 : 1 }} onClick={e => { e.stopPropagation(); setAlertFilter(alertFilter === 'warning' ? null : 'warning'); setShowAlerts(true); }}>{alertCounts.warning}</span>}
                {alertCounts.success > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-opacity" style={{ background: '#e6f9ef', color: '#22d273', opacity: alertFilter && alertFilter !== 'success' ? 0.4 : 1 }} onClick={e => { e.stopPropagation(); setAlertFilter(alertFilter === 'success' ? null : 'success'); setShowAlerts(true); }}>{alertCounts.success}</span>}
                {alertCounts.info > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-opacity" style={{ background: '#dbeafe', color: '#2563eb', opacity: alertFilter && alertFilter !== 'info' ? 0.4 : 1 }} onClick={e => { e.stopPropagation(); setAlertFilter(alertFilter === 'info' ? null : 'info'); setShowAlerts(true); }}>{alertCounts.info}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span onClick={e => e.stopPropagation()}><ExportButton getData={getAlertsExport} /></span>
              {showAlerts ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
            </div>
          </div>
          {showAlerts && (
            <div className="px-5 pb-4 space-y-1.5 max-h-60 overflow-y-auto">
              {filteredAlerts.slice(0, 30).map((a, i) => {
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
              {filteredAlerts.length > 30 && <p className="text-[10px] text-center" style={{ color: '#8392a5' }}>+{filteredAlerts.length - 30} alertes</p>}
            </div>
          )}
        </div>
      )}


   {/* Term averages */}
      {termView === 'ANNUAL' && (
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
      {termView == 'ANNUAL' && (
        <>
          <MetricCard icon={<Award className="w-5 h-5" />} label="Admis" value={`${stats.promoted} (${pct(stats.promoted, students.length)}%)`} color="#22d273" bg="#e6f9ef" />
          <MetricCard icon={<AlertTriangle className="w-5 h-5" />} label="Redouble" value={`${stats.retained} (${pct(stats.retained, students.length)}%)`} color="#d4a017" bg="#fff8e1" />
          <MetricCard icon={<XCircle className="w-5 h-5" />} label="Exclu" value={`${stats.expelled} (${pct(stats.expelled, students.length)}%)`} color="#dc3545" bg="#fce8ea" />
        </>
      )}
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
        {/* Donut chart 
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
        <div className="card-cassie p-5 cursor-pointer" onClick={() => setExpandedCard('distinctions')}>
          <div className="flex items-center justify-between mb-4">
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>
              Distinctions {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
            </h6>
            <Maximize2 className="w-4 h-4" style={{ color: '#8392a5' }} />
          </div>
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
      
        {/* Sanctions */}
        <div className="card-cassie p-5 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between cursor-pointer select-none" onClick={() => toggle('sanctions')}>
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>
              Sanctions {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
            </h6>
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 cursor-pointer" style={{ color: '#8392a5' }} onClick={e => { e.stopPropagation(); setExpandedCard('sanctions'); }} />
              {collapsed.sanctions ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
            </div>
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
      </div>

    <div className="grid md:grid-cols-3 gap-5">
      {/* Radar disciplinaire */}
      {radarData.length > 0 && (
        <div className="card-cassie p-5 md:col-span-1 cursor-pointer" onClick={() => setExpandedCard('radar')}>
          <div className="flex items-center justify-between mb-4">
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>
              Radar disciplinaire {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
            </h6>
            <Maximize2 className="w-4 h-4" style={{ color: '#8392a5' }} />
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#e6e7ef" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#575d78' }} />
              <PolarRadiusAxis angle={90} domain={[0, 20]} tickCount={5} tick={{ fontSize: 9, fill: '#8392a5' }} />
              <Radar name="Moyenne de classe" dataKey="moyenne" stroke="#6c5ce7" fill="rgba(108,92,231,0.15)" strokeWidth={2} dot={{ r: 4, fill: '#6c5ce7' }} />
              <Radar name="Plus forte moyenne" dataKey="max" stroke="#00cec9" fill="rgba(0,206,201,0.08)" strokeWidth={1.5} dot={{ r: 3, fill: '#00cec9' }} />
              <Radar name="Plus faible moyenne" dataKey="min" stroke="#e17055" fill="rgba(225,112,85,0.08)" strokeWidth={1.5} dot={{ r: 3, fill: '#e17055' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as { fullName: string; moyenne: number; max: number; min: number };
                  return (
                    <div className="rounded-lg px-3 py-2 text-xs shadow-lg border" style={{ background: '#fff', borderColor: '#e6e7ef' }}>
                      <p className="font-semibold mb-1" style={{ color: '#06072d' }}>{d.fullName}</p>
                      <p style={{ color: '#6c5ce7' }}>Moyenne: {d.moyenne}</p>
                      <p style={{ color: '#00cec9' }}>Max: {d.max}</p>
                      <p style={{ color: '#e17055' }}>Min: {d.min}</p>
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Étendue — Min / Max par discipline */}
      {rangeData.length > 0 && (
        <div className="card-cassie p-5 md:col-span-2 cursor-pointer" onClick={() => setExpandedCard('etendue')}>
          <div className="flex items-center justify-between mb-4">
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>
              Étendue — Min / Max par discipline {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
            </h6>
            <Maximize2 className="w-4 h-4" style={{ color: '#8392a5' }} />
          </div>
          <ResponsiveContainer width="100%" height={Math.max(260, rangeData.length * 36)}>
            <BarChart data={rangeData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e7ef" />
              <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11, fill: '#8392a5' }} label={{ value: 'Note /20', position: 'insideBottomRight', offset: -5, style: { fontSize: 11, fill: '#8392a5' } }} />
              <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fill: '#575d78' }} width={100} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as { fullName: string; min: number; max: number; moyenne: number };
                  return (
                    <div className="rounded-lg px-3 py-2 text-xs shadow-lg border" style={{ background: '#fff', borderColor: '#e6e7ef' }}>
                      <p className="font-semibold mb-1" style={{ color: '#06072d' }}>{d.fullName}</p>
                      <p style={{ color: '#e17055' }}>Min: {d.min}</p>
                      <p style={{ color: '#6c5ce7' }}>Moyenne: {d.moyenne}</p>
                      <p style={{ color: '#00cec9' }}>Max: {d.max}</p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="range" name="Étendue (min → max)" fill="rgba(0,206,201,0.25)" stroke="#00cec9" strokeWidth={1} radius={[4, 4, 4, 4]} barSize={6}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const min = payload.min as number;
                  const max = payload.max as number;
                  const moy = payload.moyenne as number;
                  const span = max - min;
                  const moyX = span > 0 ? x + ((moy - min) / span) * width : x + width / 2;
                  return (
                    <g>
                      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="rgba(3, 68, 67, 0.25)" stroke="#00cec9" strokeWidth={1} />
                      <circle cx={x} cy={y + height / 2} r={5} fill="#e17055" />
                      <circle cx={moyX} cy={y + height / 2} r={5} fill="#6c5ce7" />
                      <circle cx={x + width} cy={y + height / 2} r={5} fill="#00cec9" />
                    </g>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>

      {/* Statistiques par Discipline */}
      {disciplineStats.length > 0 && (
        <div className="card-cassie overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between cursor-pointer select-none" onClick={() => toggle('discStats')}>
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>
              Statistiques par Discipline {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
            </h6>
            {collapsed.discStats ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
          </div>
          {!collapsed.discStats && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f9f9fd' }}>
                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Discipline</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Eff.</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Moy.</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Min</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Max</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>&lt;8.5</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>8.5–10</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>≥10</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>% ≥10</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplineStats.map(d => (
                    <tr key={d.disc} className="border-b" style={{ borderColor: '#e6e7ef' }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: '#06072d' }}>{d.disc}</td>
                      <td className="px-3 py-2.5 text-center" style={{ color: '#575d78' }}>{d.eff}</td>
                      <td className="px-3 py-2.5 text-center font-medium" style={{ color: '#5556fd' }}>{d.moy.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center" style={{ color: '#e17055' }}>{d.min.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center" style={{ color: '#00cec9' }}>{d.max.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center" style={{ color: d.lt85 > 0 ? '#dc3545' : '#c0ccda', fontWeight: d.lt85 > 0 ? 700 : 400 }}>{d.lt85}</td>
                      <td className="px-3 py-2.5 text-center" style={{ color: '#575d78' }}>{d.mid}</td>
                      <td className="px-3 py-2.5 text-center" style={{ color: '#575d78' }}>{d.gte10}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="h-1.5 rounded-full" style={{
                            width: Math.max(4, d.pct10 * 0.6),
                            background: d.pct10 >= 95 ? '#22d273' : d.pct10 >= 80 ? '#5556fd' : d.pct10 >= 60 ? '#ffc107' : '#dc3545',
                          }} />
                          <span className="text-xs font-medium" style={{ color: '#575d78' }}>{d.pct10}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <AppreciationBadge app={d.app} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top N */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between cursor-pointer select-none" style={{ borderColor: '#e6e7ef' }} onClick={() => toggle('top')}>
          <div className="flex items-center gap-2">
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Meilleurs</h6>
            <CountSelect value={topCount} onChange={setTopCount} max={students.length} onClick={e => e.stopPropagation()} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>élèves</h6>
            <span className="text-xs" style={{ color: '#8392a5' }}>|</span>
            <span className="text-xs" style={{ color: '#8392a5' }}>≥</span>
            <ThresholdInput value={topThreshold} onChange={setTopThreshold} onClick={e => e.stopPropagation()} />
          </div>
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
                  <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>#</th>
                  <SortTH table="top" k="matricule" label="Matricule" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="top" k="name" label="Élève" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="top" k="avg" label={`Moy. ${periodLabel}`} sorts={sorts} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Distinction</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Sanction</th>
                {termView === 'ANNUAL' && (  <SortTH table="top" k="status" label="Statut" sorts={sorts} onSort={toggleSort} />)}
                </tr>
              </thead>
              <tbody>
                {topStudents.map((s, i) => (
                  <tr key={s.matricule} className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }} onClick={() => onStudentClick(s)}>
                    <td className="px-5 py-2.5 font-bold" style={{ color: '#c0ccda' }}>
                      {i + 1}
                    </td>
                    
                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.matricule}</div>
                    </td>  

                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.fullName}</div>
                    </td>

                    <td className="px-3 py-2.5 font-bold" style={{ color: '#5556fd' }}>
                      {getStudentAvg(s)?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5"><DistinctionBadge distinction={getStudentDistinction(s)} /></td>
                    <td className="px-3 py-2.5"><SanctionBadge sanction={getStudentSanction(s)} /></td>
                    {termView === 'ANNUAL' && (<td className="px-3 py-2.5"><PromotionBadge status={s.yearResult?.promotionStatus ?? null} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lowest N */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between cursor-pointer select-none" style={{ borderColor: '#d42b42' }} onClick={() => toggle('bottom')}>
          <div className="flex items-center gap-2">
            <h6 className="font-medium text-sm" style={{ color: '#d42b42' }}>Derniers</h6>
            <CountSelect value={bottomCount} onChange={setBottomCount} max={students.length} onClick={e => e.stopPropagation()} />
            <h6 className="font-medium text-sm" style={{ color: '#d42b42' }}>élèves</h6>
            <span className="text-xs" style={{ color: '#8392a5' }}>|</span>
            <span className="text-xs" style={{ color: '#8392a5' }}>&lt;</span>
            <ThresholdInput value={bottomThreshold} onChange={setBottomThreshold} onClick={e => e.stopPropagation()} />
          </div>
          <div className="flex items-center gap-2">
            <span onClick={e => e.stopPropagation()}><ExportButton getData={getBottomStudentsExport} /></span>
            {collapsed.bottom ? <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} />}
          </div>
        </div>
        {!collapsed.bottom && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f9f9fd' }}>
                  <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>#</th>
                  <SortTH table="bottom" k="matricule" label="Matricule" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="bottom" k="name" label="Élève" sorts={sorts} onSort={toggleSort} />
                  <SortTH table="bottom" k="avg" label={`Moy. ${periodLabel}`} sorts={sorts} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Distinction</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Sanction</th>
                  {termView === 'ANNUAL' && (<SortTH table="bottom" k="status" label="Statut" sorts={sorts} onSort={toggleSort} />)}
                </tr>
              </thead>
              <tbody>
                {bottomStudents.map((s, i) => (
                  <tr key={s.matricule} className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#e6e7ef' }} onClick={() => onStudentClick(s)}>
                    <td className="px-5 py-2.5 font-bold" style={{ color: '#c0ccda' }}>#{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.matricule}</div>
                    </td>  

                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.fullName}</div>
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: '#dc3545' }}>
                      {getStudentAvg(s)?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5"><DistinctionBadge distinction={getStudentDistinction(s)} /></td>
                    <td className="px-3 py-2.5"><SanctionBadge sanction={getStudentSanction(s)} /></td>
                    {termView === 'ANNUAL' && (<td className="px-3 py-2.5"><PromotionBadge status={s.yearResult?.promotionStatus ?? null} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded card modal */}
      {expandedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setExpandedCard(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-h-[90vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100 transition-colors" onClick={() => setExpandedCard(null)}>
              <X className="w-5 h-5" style={{ color: '#8392a5' }} />
            </button>

            {expandedCard === 'distinctions' && (
              <>
                <h5 className="font-semibold text-base mb-5" style={{ color: '#06072d' }}>
                  Distinctions {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
                </h5>
                {distinctionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={distinctionData} margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e7ef" />
                      <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#575d78' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#8392a5' }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 13 }}>
                        {distinctionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-center py-10" style={{ color: '#c0ccda' }}>Aucune distinction</p>
                )}
              </>
            )}

            {expandedCard === 'sanctions' && (
              <>
                <h5 className="font-semibold text-base mb-5" style={{ color: '#06072d' }}>
                  Sanctions {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
                </h5>
                {sanctionData.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {sanctionData.map(d => (
                      <div key={d.name} className="p-5 rounded text-center" style={{ background: d.color + '15' }}>
                        <p className="text-4xl font-bold" style={{ color: d.color }}>{d.value}</p>
                        <p className="text-xs uppercase tracking-widest mt-2" style={{ color: d.color }}>{d.name}</p>
                        <p className="text-xs mt-1" style={{ color: '#8392a5' }}>{sanctionLabels[d.name]}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center py-10" style={{ color: '#c0ccda' }}>Aucune sanction</p>
                )}
              </>
            )}

            {expandedCard === 'radar' && (
              <>
                <h5 className="font-semibold text-base mb-5" style={{ color: '#06072d' }}>
                  Radar disciplinaire {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
                </h5>
                <ResponsiveContainer width="100%" height={550}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                    <PolarGrid stroke="#e6e7ef" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#575d78' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 20]} tickCount={5} tick={{ fontSize: 10, fill: '#8392a5' }} />
                    <Radar name="Moyenne de classe" dataKey="moyenne" stroke="#6c5ce7" fill="rgba(108,92,231,0.15)" strokeWidth={2} dot={{ r: 5, fill: '#6c5ce7' }} />
                    <Radar name="Plus forte moyenne" dataKey="max" stroke="#00cec9" fill="rgba(0,206,201,0.08)" strokeWidth={1.5} dot={{ r: 4, fill: '#00cec9' }} />
                    <Radar name="Plus faible moyenne" dataKey="min" stroke="#e17055" fill="rgba(225,112,85,0.08)" strokeWidth={1.5} dot={{ r: 4, fill: '#e17055' }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { fullName: string; moyenne: number; max: number; min: number };
                        return (
                          <div className="rounded-lg px-3 py-2 text-xs shadow-lg border" style={{ background: '#fff', borderColor: '#e6e7ef' }}>
                            <p className="font-semibold mb-1" style={{ color: '#06072d' }}>{d.fullName}</p>
                            <p style={{ color: '#6c5ce7' }}>Moyenne: {d.moyenne}</p>
                            <p style={{ color: '#00cec9' }}>Max: {d.max}</p>
                            <p style={{ color: '#e17055' }}>Min: {d.min}</p>
                          </div>
                        );
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </>
            )}

            {expandedCard === 'etendue' && (
              <>
                <h5 className="font-semibold text-base mb-5" style={{ color: '#06072d' }}>
                  Étendue — Min / Max par discipline {termView !== 'ANNUAL' ? `(${termView})` : '(annuel)'}
                </h5>
                <ResponsiveContainer width="100%" height={Math.max(400, rangeData.length * 44)}>
                  <BarChart data={rangeData} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e7ef" />
                    <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 12, fill: '#8392a5' }} label={{ value: 'Note /20', position: 'insideBottomRight', offset: -5, style: { fontSize: 12, fill: '#8392a5' } }} />
                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 12, fill: '#575d78' }} width={120} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { fullName: string; min: number; max: number; moyenne: number };
                        return (
                          <div className="rounded-lg px-3 py-2 text-xs shadow-lg border" style={{ background: '#fff', borderColor: '#e6e7ef' }}>
                            <p className="font-semibold mb-1" style={{ color: '#06072d' }}>{d.fullName}</p>
                            <p style={{ color: '#e17055' }}>Min: {d.min}</p>
                            <p style={{ color: '#6c5ce7' }}>Moyenne: {d.moyenne}</p>
                            <p style={{ color: '#00cec9' }}>Max: {d.max}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="range" name="Étendue (min → max)" fill="rgba(0,206,201,0.25)" stroke="#00cec9" strokeWidth={1} radius={[4, 4, 4, 4]} barSize={8}
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const min = payload.min as number;
                        const max = payload.max as number;
                        const moy = payload.moyenne as number;
                        const span = max - min;
                        const moyX = span > 0 ? x + ((moy - min) / span) * width : x + width / 2;
                        return (
                          <g>
                            <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="rgba(0,206,201,0.25)" stroke="#00cec9" strokeWidth={1} />
                            <circle cx={x} cy={y + height / 2} r={6} fill="#e17055" />
                            <circle cx={moyX} cy={y + height / 2} r={6} fill="#6c5ce7" />
                            <circle cx={x + width} cy={y + height / 2} r={6} fill="#00cec9" />
                          </g>
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      )}
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

const COUNT_OPTIONS = [3, 5, 10, 15, 20, 25, 30];

function CountSelect({ value, onChange, max, onClick }: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      onClick={onClick}
      className="text-xs font-medium rounded px-2 py-1 border appearance-auto cursor-pointer"
      style={{ borderColor: '#e6e7ef', color: '#5556fd', background: '#f9f9fd' }}
    >
      {COUNT_OPTIONS.filter(n => n <= max || n === value).map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

function ThresholdInput({ value, onChange, onClick }: {
  value: number | null;
  onChange: (v: number | null) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      step={0.5}
      value={value ?? ''}
      placeholder="/20"
      onChange={e => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      onClick={onClick}
      className="text-xs font-medium rounded px-2 py-1 border w-16 text-center"
      style={{ borderColor: '#e6e7ef', color: '#5556fd', background: '#f9f9fd' }}
    />
  );
}

const sanctionLabels: Record<string, string> = {
  BTI: 'Blâme travail insuffisant',
  AVT: 'Avertissement travail',
  BMC: 'Blâme mauvaise conduite',
  AMC: 'Avertissement conduite',
};

function AppreciationBadge({ app }: { app: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    Excellent: { bg: '#e6f9ef', color: '#22d273' },
    Bien: { bg: '#f0f0ff', color: '#5556fd' },
    'Assez Bien': { bg: '#fff8e1', color: '#d4a017' },
    Passable: { bg: '#fff5eb', color: '#fca665' },
    Insuffisant: { bg: '#fce8ea', color: '#dc3545' },
  };
  const s = styles[app] ?? { bg: '#f3f6f9', color: '#637382' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {app}
    </span>
  );
}
