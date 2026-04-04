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

export default function StudentProgression({ student, classStudents, currentTerm, isAnnual }: Props) {
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
     
      {/* ── Section 2: Average evolution chart ── */}
      {avgChartData.some(d => d.eleve != null) && (
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
      )}



    </div>
  );
}
