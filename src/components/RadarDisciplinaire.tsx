import { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import type { K12Student, TermId } from '../types/k12';

interface Props {
  student: K12Student;
  classStudents: K12Student[];
  termId: TermId;
}

export default function RadarDisciplinaire({ student, classStudents, termId }: Props) {
  const data = useMemo(() => {
    // Collect student's discipline averages for the term
    const subjects = student.subjectGrades
      .filter(sg => sg.terms[termId]?.average != null && sg.coefficient > 0)
      .map(sg => {
        const studentAvg = sg.terms[termId]?.average ?? 0;

        // Compute class average for this subject
        const classAvgs = classStudents
          .map(s => {
            const csg = s.subjectGrades.find(g => g.subjectCode === sg.subjectCode);
            return csg?.terms[termId]?.average ?? null;
          })
          .filter((v): v is number => v != null);
        const classAvg = classAvgs.length > 0
          ? classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length
          : 0;

        // Short label for radar
        const shortName = sg.subjectName.length > 12
          ? sg.subjectName.substring(0, 11) + '…'
          : sg.subjectName;

        return {
          subject: shortName,
          fullName: sg.subjectName,
          student: Math.round(studentAvg * 100) / 100,
          classe: Math.round(classAvg * 100) / 100,
        };
      });

    return subjects;
  }, [student, classStudents, termId]);

  // Summary stats
  const summary = useMemo(() => {
    let above = 0, below = 0;
    let bestSubject = '', bestScore = -1;
    let worstSubject = '', worstScore = 21;
    let totalDiff = 0;

    for (const d of data) {
      if (d.student > d.classe) above++;
      else if (d.student < d.classe) below++;
      if (d.student > bestScore) { bestScore = d.student; bestSubject = d.fullName; }
      if (d.student < worstScore) { worstScore = d.student; worstSubject = d.fullName; }
      totalDiff += d.student - d.classe;
    }

    return {
      aboveClass: above,
      belowClass: below,
      bestSubject,
      bestScore,
      worstSubject,
      worstScore,
      avgDiff: data.length > 0 ? totalDiff / data.length : 0,
    };
  }, [data]);

  if (data.length < 3) {
    return (
      <div className="card-cassie p-5">
        <h6 className="font-medium text-sm mb-2" style={{ color: '#06072d' }}>Profil disciplinaire ({termId})</h6>
        <p className="text-sm" style={{ color: '#8392a5' }}>Données insuffisantes pour le radar (min. 3 matières)</p>
      </div>
    );
  }

  return (
    <div className="card-cassie p-5">
      <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>Profil disciplinaire ({termId})</h6>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Radar chart */}
        <div className="flex-1" style={{ minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#e6e7ef" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#575d78' }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 20]}
                tick={{ fontSize: 9, fill: '#8392a5' }}
                tickCount={5}
              />
              <Radar
                name="Élève"
                dataKey="student"
                stroke="#009A44"
                fill="#009A44"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Radar
                name="Moy. classe"
                dataKey="classe"
                stroke="#FF8200"
                fill="#FF8200"
                fillOpacity={0.08}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Tooltip
                formatter={(v: number, name: string) => [`${v.toFixed(2)}/20`, name]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary indicators */}
        <div className="flex flex-col gap-2 lg:w-48 text-[11px]">
          <div className="p-2 rounded" style={{ background: '#e6f9ef' }}>
            <span style={{ color: '#8392a5' }}>Au-dessus de la classe</span>
            <p className="font-bold text-sm" style={{ color: '#22d273' }}>{summary.aboveClass} matière{summary.aboveClass !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-2 rounded" style={{ background: '#fce8ea' }}>
            <span style={{ color: '#8392a5' }}>En dessous de la classe</span>
            <p className="font-bold text-sm" style={{ color: '#dc3545' }}>{summary.belowClass} matière{summary.belowClass !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-2 rounded" style={{ background: '#f0f0ff' }}>
            <span style={{ color: '#8392a5' }}>Meilleure discipline</span>
            <p className="font-bold text-sm" style={{ color: '#5556fd' }}>{summary.bestSubject}</p>
            <p style={{ color: '#8392a5' }}>{summary.bestScore.toFixed(2)}/20</p>
          </div>
          <div className="p-2 rounded" style={{ background: '#f3f6f9' }}>
            <span style={{ color: '#8392a5' }}>Plus faible discipline</span>
            <p className="font-bold text-sm" style={{ color: '#637382' }}>{summary.worstSubject}</p>
            <p style={{ color: '#8392a5' }}>{summary.worstScore.toFixed(2)}/20</p>
          </div>
          <div className="p-2 rounded" style={{ background: summary.avgDiff >= 0 ? '#e6f9ef' : '#fce8ea' }}>
            <span style={{ color: '#8392a5' }}>Écart moyen vs classe</span>
            <p className="font-bold text-sm" style={{ color: summary.avgDiff >= 0 ? '#22d273' : '#dc3545' }}>
              {summary.avgDiff >= 0 ? '+' : ''}{summary.avgDiff.toFixed(2)} pts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
