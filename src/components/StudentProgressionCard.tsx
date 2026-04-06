import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend, Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import type { K12Student, TermId } from '../types/k12';
import type { ProgressionReport } from '../types/analytics';
import { PROFILE_META } from '../types/analytics';
import { generateProgressionReport, classifyDisciplineProfile } from '../utils/analyticsCalculations';
import MetricCard, { DeltaBadge } from './MetricCard';

interface Props {
  student: K12Student;
  classStudents: K12Student[];
  currentTerm: TermId;
  isAnnual?: boolean;
}

export default function StudentProgressionCard({ student, classStudents, currentTerm, isAnnual }: Props) {
  const report = useMemo(
    () => generateProgressionReport(student, classStudents, currentTerm, isAnnual),
    [student, classStudents, currentTerm, isAnnual],
  );

  const profileMeta = PROFILE_META[report.profile];
  const discProfileLabels: Record<string, string> = {
    litteraire: 'Profil littéraire',
    scientifique: 'Profil scientifique',
    equilibre: 'Profil équilibré',
  };

  // Average evolution chart data
  const avgChartData = report.snapshots.map(s => ({
    term: s.termId,
    eleve: s.average,
    classe: s.classAverage,
  }));

  // Rank evolution chart data (inverted Y axis)
  const rankChartData = report.snapshots
    .filter(s => s.rank > 0)
    .map(s => ({
      term: s.termId,
      rang: s.rank,
      total: s.totalStudents,
    }));

  const maxStudents = Math.max(...rankChartData.map(d => d.total), 1);

  return (
    <div className="space-y-5">
      {/* ── Section 1: Metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Moyenne"
          value={report.snapshots.find(s => s.termId === currentTerm)?.average?.toFixed(2) ?? '—'}
          suffix="/20"
          deltas={report.deltas.moyenneDelta.map(d => ({ delta: d }))}
        />
        <MetricCard
          label="Rang"
          value={report.snapshots.find(s => s.termId === currentTerm)?.rank || '—'}
          suffix={`/${report.snapshots.find(s => s.termId === currentTerm)?.totalStudents ?? ''}`}
          deltas={report.deltas.rangDelta.map(d => ({ delta: d, format: 'rank' as const }))}
        />
        <div className="card-cassie p-4">
          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#8392a5' }}>Distinction</p>
          {report.snapshots.filter(s => s.distinction || s.sanction).length >= 2 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {report.snapshots.filter(s => s.average !== null).map(s => (
                <span key={s.termId} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#f3f6f9', color: '#575d78' }}>
                  {s.termId}: {s.distinction ?? s.sanction ?? '—'}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-lg font-bold mt-0.5" style={{ color: '#06072d' }}>
              {report.snapshots.find(s => s.termId === currentTerm)?.distinction
                ?? report.snapshots.find(s => s.termId === currentTerm)?.sanction
                ?? '—'}
            </p>
          )}
        </div>
        <div className="card-cassie p-4">
          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#8392a5' }}>Position vs classe</p>
          <p className="text-lg font-bold mt-0.5" style={{
            color: report.positionVsClass != null
              ? (report.positionVsClass >= 0 ? '#22d273' : '#dc3545')
              : '#06072d'
          }}>
            {report.positionVsClass != null
              ? `${report.positionVsClass >= 0 ? '+' : ''}${report.positionVsClass.toFixed(2)} pts`
              : '—'}
          </p>
          {report.percentile != null && (
            <p className="text-[10px] mt-1" style={{ color: '#8392a5' }}>
              Meilleur que {report.percentile}% de la classe
            </p>
          )}
        </div>
      </div>

      {/* ── Badges row ── */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: profileMeta.bg, color: profileMeta.color }}>
          {profileMeta.label}
        </span>
        <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#f0f0ff', color: '#5556fd' }}>
          {discProfileLabels[report.disciplineProfile]} ({isAnnual ? 'Annuel' : currentTerm})
        </span>
        {report.volatility != null && (
          <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: '#f3f6f9', color: '#637382' }}>
            Volatilité : {report.volatility < 0.5 ? 'Stable' : report.volatility < 1 ? 'Modérée' : 'Forte'} ({report.volatility.toFixed(2)})
          </span>
        )}
        {report.trend != null && currentTerm !== 'T1' && (
          <span className="text-[11px] px-3 py-1 rounded-full" style={{
            background: report.trend >= 0 ? '#e6f9ef' : '#fce8ea',
            color: report.trend >= 0 ? '#22d273' : '#dc3545',
          }}>
            Tendance : {report.trend >= 0 ? '▲' : '▼'} {Math.abs(report.trend).toFixed(2)} pts/trim.
          </span>
        )}
        {report.predictedNext != null && (
          <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: '#fff8e1', color: '#856404' }}>
            Prévision : ~{report.predictedNext.toFixed(1)}/20
          </span>
        )}
      </div>

      {/* ── Section 2: Average evolution chart ── */}
      {/* {avgChartData.some(d => d.eleve != null) && (
        <div className="card-cassie p-5">
          <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>Évolution des moyennes</h6>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={avgChartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e7ef" />
              <XAxis dataKey="term" tick={{ fontSize: 12, fill: '#575d78' }} />
              <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: '#8392a5' }} />
              <ReferenceLine y={10} stroke="#dc3545" strokeDasharray="3 3" label={{ value: '10', fill: '#dc3545', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v?.toFixed(2) ?? '—'}/20`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="eleve" name="Élève" stroke="#009A44" strokeWidth={2.5} dot={{ r: 5, fill: '#009A44' }} connectNulls />
              <Line type="monotone" dataKey="classe" name="Moy. classe" stroke="#FF8200" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )} */}

      {/* ── Section 3: Rank evolution chart ── */}
      {/* {rankChartData.length >= 2 && (
        <div className="card-cassie p-5">
          <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>Évolution du rang</h6>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rankChartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e7ef" />
              <XAxis dataKey="term" tick={{ fontSize: 12, fill: '#575d78' }} />
              <YAxis reversed domain={[1, maxStudents]} tick={{ fontSize: 11, fill: '#8392a5' }} />
              <ReferenceArea y1={1} y2={Math.ceil(maxStudents * 0.25)} fill="#22d273" fillOpacity={0.07} />
              <ReferenceArea y1={Math.ceil(maxStudents * 0.75)} y2={maxStudents} fill="#dc3545" fillOpacity={0.07} />
              <Tooltip formatter={(v: number) => [`${v}ème`]} />
              <Line type="monotone" dataKey="rang" name="Rang" stroke="#5556fd" strokeWidth={2.5} dot={{ r: 5, fill: '#5556fd' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-[10px]" style={{ color: '#8392a5' }}>
            <span><span className="inline-block w-3 h-2 rounded mr-1" style={{ background: '#22d27320' }} />Top 25%</span>
            <span><span className="inline-block w-3 h-2 rounded mr-1" style={{ background: '#dc354520' }} />Derniers 25%</span>
          </div>
        </div>
      )} */}

      {/* ── Section 4: Term-by-term table ── */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4">
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Progression détaillée</h6>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Période</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Moyenne</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Rang</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Distinction</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Δ Moyenne</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Δ Rang</th>
              </tr>
            </thead>
            <tbody>
              {report.snapshots.map((snap, i) => {
                const moyDelta = i > 0 ? report.deltas.moyenneDelta[i - 1] : null;
                const rangDelta = i > 0 ? report.deltas.rangDelta[i - 1] : null;
                return (
                  <tr key={snap.termId} className="border-b" style={{ borderColor: '#f3f6f9' }}>
                    <td className="px-5 py-2.5 font-medium" style={{ color: '#06072d' }}>{snap.termId}</td>
                    <td className="px-3 py-2.5 text-center">
                      {snap.average != null ? (
                        <span className="font-bold" style={{ color: snap.average >= 10 ? '#22d273' : '#dc3545' }}>
                          {snap.average.toFixed(2)}
                        </span>
                      ) : <span style={{ color: '#c0ccda' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{ color: '#575d78' }}>
                      {snap.rank > 0 ? `${snap.rank}/${snap.totalStudents}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-[11px]" style={{ color: '#575d78' }}>
                      {snap.distinction ?? snap.sanction ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {moyDelta ? <DeltaBadge delta={moyDelta} /> : <span style={{ color: '#c0ccda' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {rangDelta ? <DeltaBadge delta={rangDelta} format="rank" /> : <span style={{ color: '#c0ccda' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
