import { useState, useMemo } from 'react';
import { ArrowLeft, ChevronDown, UserCircle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend, Tooltip, ReferenceLine,
} from 'recharts';
import type { K12Student, TermId, TermView } from '../types/k12';
import { PROFILE_META } from '../types/analytics';
import { classifyStudent, generateStudentAlerts } from '../utils/analyticsCalculations';
import { PromotionBadge, DistinctionBadge, SanctionBadge } from './Dashboard';
import RadarDisciplinaire from './RadarDisciplinaire';
import StudentProgression from './StudentProgression';
import StudentProgressionCard from './StudentProgressionCard';

interface Props {
  student: K12Student;
  classStudents: K12Student[];
  onBack: () => void;
  photoUrl?: string;
}

export default function StudentDetail({ student, classStudents, onBack, photoUrl }: Props) {
  const [expandedTerm, setExpandedTerm] = useState<TermId | null>(null);
  const [termView, setTermView] = useState<TermView>('ANNUAL');
  const [photoError, setPhotoError] = useState(false);
  const yr = student.yearResult;

  // Detect the latest term with data
  const latestTerm: TermId = useMemo(() => {
    for (const tid of ['T3', 'T2', 'T1'] as TermId[]) {
      if (yr?.termResults.some(t => t.termId === tid && t.termAverage !== null)) return tid;
    }
    return 'T1';
  }, [yr]);

  // Active term for display (selected or latest)
  const activeTerm: TermId = termView !== 'ANNUAL' ? termView as TermId : latestTerm;
  const activeTermResult = yr?.termResults.find(t => t.termId === activeTerm) ?? null;

  // Student profile
  const profile = useMemo(() => classifyStudent(student, activeTerm), [student, activeTerm]);
  const profileMeta = PROFILE_META[profile];

  // Student-specific alerts
  const studentAlerts = useMemo(
    () => activeTerm !== 'T1' ? generateStudentAlerts(student, activeTerm) : [],
    [student, activeTerm],
  );

  // Evolution chart data: T1, T2, T3 averages + class avg
  const evolutionData = useMemo(() => {
    return (['T1', 'T2', 'T3'] as const).map(tid => {
      const tr = yr?.termResults.find(t => t.termId === tid);
      const classAvgs = classStudents
        .map(s => s.yearResult?.termResults.find(t => t.termId === tid)?.termAverage ?? null)
        .filter((v): v is number => v !== null);
      const classAvg = classAvgs.length > 0
        ? Math.round((classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length) * 100) / 100
        : null;
      return {
        term: tid,
        studentAvg: tr?.termAverage ?? null,
        classAvg,
      };
    });
  }, [yr, classStudents]);

  return (
    <div className="space-y-5">
      {/* Back + Period filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium transition-colors" style={{ color: '#5556fd' }}>
          <ArrowLeft className="w-4 h-4" /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#8392a5' }}>Période :</span>
          <div className="flex items-center rounded p-0.5" style={{ background: '#f3f6f9' }}>
            {(['T1', 'T2', 'T3', 'ANNUAL'] as const).map(tv => (
              <button
                key={tv}
                onClick={() => setTermView(tv)}
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
      </div>

      {/* Student header */}
      <div className="card-cassie p-6">
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex-shrink-0">
            {photoUrl && !photoError ? (
              <img src={photoUrl} alt={`Photo de ${student.fullName}`}
                className="rounded-lg object-cover border-2"
                style={{ width: 90, height: 110, borderColor: '#e6e7ef', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
                onError={() => setPhotoError(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="rounded-lg flex items-center justify-center border-2"
                style={{ width: 90, height: 110, borderColor: '#e6e7ef', background: '#f3f6f9', borderStyle: 'dashed' }}>
                <UserCircle className="w-10 h-10" style={{ color: '#c0ccda' }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: '#06072d' }}>{student.matricule} — {student.fullName}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[11px] px-3 py-1 rounded" style={{ background: '#f3f6f9', color: '#637382' }}>
                {student.className}
              </span>
              {student.branch && (
                <span className="text-[11px] px-3 py-1 rounded" style={{ background: '#f0f0ff', color: '#5556fd' }}>
                  Filière {student.branch}
                </span>
              )}
              {student.isRepeating && (
                <span className="text-[11px] px-3 py-1 rounded" style={{ background: '#fff8e1', color: '#d4a017' }}>
                  Redoublant
                </span>
              )}
              <span className="text-[11px] font-semibold px-3 py-1 rounded" style={{ background: profileMeta.bg, color: profileMeta.color }}>
                {profileMeta.label}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <InfoPill
              label="Rang"
              value={termView === 'ANNUAL'
                ? (yr ? `${yr.rank}/${yr.totalStudents}` : '—')
                : (activeTermResult ? `${activeTermResult.rank}/${activeTermResult.totalStudents}` : '—')
              }
            />
            <InfoPill
              label={termView === 'ANNUAL' ? 'Moy. Annuelle' : `Moy. ${activeTerm}`}
              value={termView === 'ANNUAL'
                ? (yr?.yearAverage != null ? `${yr.yearAverage.toFixed(2)}/20` : '—')
                : (activeTermResult?.termAverage != null ? `${activeTermResult.termAverage.toFixed(2)}/20` : '—')
              }
              highlight={termView === 'ANNUAL'
                ? (yr?.yearAverage != null ? yr.yearAverage >= 10 : undefined)
                : (activeTermResult?.termAverage != null ? activeTermResult.termAverage >= 10 : undefined)
              }
            />
            {termView === 'ANNUAL' && (
              <InfoPill label="Filière" value={yr?.suggestedBranch ?? student.branch ?? '—'} />
            )}
            {termView === 'ANNUAL' && (
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8392a5' }}>Statut</p>
                <PromotionBadge status={yr?.promotionStatus ?? null} />
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Progression report */}
        <StudentProgressionCard student={student} classStudents={classStudents} currentTerm={activeTerm} isAnnual={termView === 'ANNUAL'} />

      {/* Term summary cards */}
      {/* <div className="grid grid-cols-3 gap-4">
        {(['T1', 'T2', 'T3'] as const).map(tid => {
          const tr = yr?.termResults.find(t => t.termId === tid);
          return (
            <div key={tid} className="card-cassie p-4">
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#8392a5' }}>{tid}</p>
              <p className="text-2xl font-bold" style={{
                color: tr?.termAverage != null ? (tr.termAverage >= 10 ? '#22d273' : '#dc3545') : '#c0ccda',
                fontFamily: "'Oswald', sans-serif",
              }}>
                {tr?.termAverage?.toFixed(2) ?? '—'}
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#8392a5' }}>/20</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <DistinctionBadge distinction={tr?.distinction ?? null} />
                <SanctionBadge sanction={tr?.sanction ?? null} />
              </div>
              {tr && (
                <p className="text-[10px] mt-2" style={{ color: '#8392a5' }}>
                  Rang : {tr.rank}/{tr.totalStudents}
                </p>
              )}
            </div>
          );
        })}
      </div> */}

      
      {/* Student alerts */}
      {/* {studentAlerts.length > 0 && (
        <div className="space-y-1.5">
          {studentAlerts.map((a, i) => {
            const sc: Record<string, { bg: string; color: string; border: string }> = {
              danger: { bg: '#fce8ea', color: '#dc3545', border: '#f5c6cb' },
              warning: { bg: '#fff8e1', color: '#856404', border: '#ffeeba' },
              success: { bg: '#e6f9ef', color: '#166534', border: '#c3e6cb' },
              info: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
            };
            const s = sc[a.severity];
            return (
              <div key={i} className="text-[11px] px-4 py-2 rounded border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
                {a.message}
              </div>
            );
          })}
        </div>
      )} */}

      {/* Radar + Progression side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar disciplinaire */}
        <RadarDisciplinaire student={student} classStudents={classStudents} termId={activeTerm} />

        {/* Progression report */}
        <StudentProgression student={student} classStudents={classStudents} currentTerm={activeTerm} isAnnual={termView === 'ANNUAL'} />
      </div>

     
      {/* Per-term subject breakdown */}
      {(termView === 'ANNUAL' ? student.termMarks : student.termMarks.filter(tm => tm.termId === activeTerm)).map(tm => (
        <div key={tm.termId} className="card-cassie overflow-hidden">
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-[#f9f9fd] transition-colors"
            style={{ borderBottom: expandedTerm === tm.termId ? '1px solid #e6e7ef' : 'none' }}
            onClick={() => setExpandedTerm(expandedTerm === tm.termId ? null : tm.termId)}
          >
            <div className="flex items-center gap-3">
              <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Notes {tm.termId}</h6>
              <span className="text-xs font-medium px-2 py-0.5 rounded"
                style={{
                  background: (tm.termAverage ?? 0) >= 10 ? '#e6f9ef' : '#fce8ea',
                  color: (tm.termAverage ?? 0) >= 10 ? '#22d273' : '#dc3545',
                }}>
                Moy: {tm.termAverage?.toFixed(2) ?? '—'}/20
              </span>
            </div>
            <ChevronDown
              className="w-5 h-5 shrink-0 transition-transform duration-200"
              style={{ color: '#c0ccda', transform: expandedTerm === tm.termId ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>
          <div className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: expandedTerm === tm.termId ? '800px' : '0' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f9f9fd' }}>
                    <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Matière</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Coeff.</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Note</th>
                    <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {tm.subjectMarks.map(sm => (
                    <tr key={sm.subjectCode} className="border-b hover:bg-[#f9f9fd] transition-colors" style={{ borderColor: '#f3f6f9' }}>
                      <td className="px-5 py-2.5">
                        <span style={{ color: '#575d78' }}>{sm.subjectName}</span>
                        {sm.isBonus && <span className="ml-1 text-[10px] px-1 rounded" style={{ background: '#f0f0ff', color: '#5556fd' }}>bonus</span>}
                        {sm.isBehavioral && <span className="ml-1 text-[10px] px-1 rounded" style={{ background: '#f0e6ff', color: '#7c3aed' }}>conduite</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center" style={{ color: '#8392a5' }}>{sm.coefficient}</td>
                      <td className="px-3 py-2.5 text-center">
                        {sm.mark != null ? (
                          <span className="font-bold" style={{ color: sm.mark >= 10 ? '#22d273' : '#dc3545' }}>
                            {sm.mark.toFixed(2)}
                          </span>
                        ) : <span style={{ color: '#c0ccda' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs" style={{ color: '#8392a5' }}>
                        {sm.mark != null ? getAppreciation(sm.mark) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {/* Branch orientation (for lycée) */}
      {yr?.suggestedBranch && (
        <div className="card-cassie p-4" style={{ borderLeft: '3px solid #5556fd', background: '#f8f8ff' }}>
          <p className="text-sm font-medium" style={{ color: '#5556fd' }}>Orientation filière suggérée</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#06072d' }}>{yr.suggestedBranch}</p>
          {student.branch && yr.suggestedBranch !== student.branch && (
            <p className="text-xs mt-1" style={{ color: '#8392a5' }}>
              Changement de filière : {student.branch} → {yr.suggestedBranch}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>{label}</p>
      <p className="font-bold text-lg" style={{
        color: highlight === true ? '#22d273' : highlight === false ? '#dc3545' : '#06072d'
      }}>
        {value}
      </p>
    </div>
  );
}

function getAppreciation(mark: number): string {
  if (mark >= 16) return 'Très bien';
  if (mark >= 14) return 'Bien';
  if (mark >= 12) return 'Assez bien';
  if (mark >= 10) return 'Passable';
  if (mark >= 8) return 'Insuffisant';
  return 'Très insuffisant';
}
