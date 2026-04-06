import { useState, useMemo } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, UserCircle } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts';
import type { Student, StudentUEResult, StudentECUEResult } from '../types';
import { StatusBadge } from './Dashboard';

interface Props {
  student: Student;
  classStudents: Student[];
  onBack: () => void;
  photoUrl?: string;
}

export default function StudentDetail({ student, classStudents, onBack, photoUrl }: Props) {
  const [expandedUE, setExpandedUE] = useState<string | null>(null);

  const radarData = useMemo(() => {
    return student.ueResults.map(ue => {
      const classAvgs = classStudents
        .map(s => s.ueResults.find(u => u.ueCode === ue.ueCode)?.average ?? 0)
        .filter(v => v > 0);
      const classAvg = classAvgs.length > 0
        ? Math.round((classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length) * 100) / 100
        : 0;
      const name = ue.ueName.length > 22 ? ue.ueName.slice(0, 20) + '…' : ue.ueName;
      return { ueName: name, studentAvg: ue.average, classAvg };
    });
  }, [student, classStudents]);

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium transition-colors"
        style={{ color: '#5556fd' }}
      >
        <ArrowLeft className="w-4 h-4" /> Retour à la liste
      </button>

      {/* Student header card */}
      <div className="card-cassie p-6">
        <div className="flex flex-wrap gap-6 items-start">
          {/* ID Photo */}
          <div className="flex-shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Photo de ${student.name}`}
                className="rounded-lg object-cover border-2"
                style={{ width: 90, height: 110, borderColor: '#e6e7ef', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
              />
            ) : (
              <div
                className="rounded-lg flex items-center justify-center border-2"
                style={{ width: 90, height: 110, borderColor: '#e6e7ef', background: '#f3f6f9', borderStyle: 'dashed' }}
              >
                <UserCircle className="w-10 h-10" style={{ color: '#c0ccda' }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: '#06072d' }}>{student.name}</h2>
            <p className="font-mono text-sm" style={{ color: '#8392a5' }}>{student.matricule}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <InfoPill label="Rang" value={`${student.rank === 1 ? '1er' : `${student.rank}e`}${student.isExAequo ? ' ex' : ''}`} />
            <InfoPill label="Moyenne" value={`${student.semesterAverage.toFixed(2)}/20`} highlight={student.semesterAverage >= 10} />
            <InfoPill label="Crédits" value={`${student.totalCredits}/${student.ueResults.reduce((s, u) => s + u.totalCredits, 0)}`} />
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8392a5' }}>Statut</p>
              <StatusBadge status={student.status} />
            </div>
          </div>
        </div>

        {/* Session badge */}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="text-[11px] px-3 py-1 rounded"
            style={student.session === 'SR'
              ? { background: '#f0e6ff', color: '#7c3aed' }
              : { background: '#f3f6f9', color: '#637382' }
            }>
            Session {student.session === 'SR' ? 'de Rattrapage (SR)' : '1'}
          </span>
          {student.eligibleRepechage && (
            <span className="text-[11px] px-3 py-1 rounded flex items-center gap-1"
              style={{ background: '#fff5eb', color: '#b86e1d' }}>
              <AlertTriangle className="w-3 h-3" /> Éligible au repêchage
            </span>
          )}
        </div>
      </div>

      {/* Repêchage detail */}
      {student.eligibleRepechage && student.repechageUECode && (
        <div className="card-cassie p-4" style={{ borderLeft: '3px solid #fca665', background: '#fffaf5' }}>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#fca665' }} />
            <div>
              <p className="font-medium text-sm" style={{ color: '#b86e1d' }}>Conditions de repêchage remplies</p>
              <p className="text-sm mt-1" style={{ color: '#8b5e24' }}>
                L'étudiant a {student.totalCredits}/{student.ueResults.reduce((s, u) => s + u.totalCredits, 0)} crédits (≥ 80%) et la moyenne de l'UE non validée est de{' '}
                <strong>{student.repechageUEAvg?.toFixed(2)}/20</strong> (≥ 9,50).
              </p>
              <p className="text-sm mt-1" style={{ color: '#8b5e24' }}>
                UE concernée : {student.ueResults.find(u => u.ueCode === student.repechageUECode)?.ueName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Radar chart — Performance par UE */}
      {radarData.length >= 3 && (
        <div className="card-cassie p-5">
          <h6 className="font-medium text-sm mb-4" style={{ color: '#06072d' }}>Performance par UE</h6>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e6e7ef" />
              <PolarAngleAxis dataKey="ueName" tick={{ fontSize: 10, fill: '#575d78' }} />
              <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 9, fill: '#8392a5' }} tickCount={5} />
              <Radar name="Étudiant" dataKey="studentAvg" stroke="#009A44" fill="#009A44" fillOpacity={0.25} />
              {classStudents.length > 1 && (
                <Radar name="Moyenne classe" dataKey="classAvg" stroke="#FF8200" fill="#FF8200" fillOpacity={0.1} />
              )}
              <Legend />
              <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(2)}/20` : ""} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* UE / ECUE breakdown — Accordion */}
      {student.ueResults.map(ue => (
        <UECard
          key={ue.ueCode}
          ue={ue}
          expanded={expandedUE === ue.ueCode}
          onToggle={() => setExpandedUE(expandedUE === ue.ueCode ? null : ue.ueCode)}
        />
      ))}
    </div>
  );
}

function UECard({ ue, expanded, onToggle }: { ue: StudentUEResult; expanded: boolean; onToggle: () => void }) {
  const borderColor = ue.validated
    ? ue.compensated ? '#ffc107' : '#22d273'
    : '#dc3545';

  return (
    <div className="card-cassie overflow-hidden" style={{ borderLeft: `3px solid ${borderColor}` }}>
      {/* UE header — clickable */}
      <div
        className="px-5 py-4 flex flex-wrap gap-4 items-center cursor-pointer select-none hover:bg-[#f9f9fd] transition-colors"
        style={{ borderBottom: expanded ? '1px solid #e6e7ef' : 'none' }}
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {ue.validated
              ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#22d273' }} />
              : <XCircle className="w-4 h-4 shrink-0" style={{ color: '#dc3545' }} />}
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>{ue.ueName}</h6>
          </div>
          {ue.compensated && (
            <span className="text-[11px] px-2 py-0.5 rounded ml-6" style={{ background: '#fff8e1', color: '#d4a017' }}>
              Validé par compensation
            </span>
          )}
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>Moyenne UE</p>
            <p className="font-bold text-lg" style={{ color: ue.average >= 10 ? '#22d273' : '#dc3545' }}>
              {ue.average.toFixed(2)}/20
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8392a5' }}>Crédits</p>
            <p className="font-bold text-lg" style={{ color: '#06072d' }}>{ue.creditsEarned}/{ue.totalCredits}</p>
          </div>
        </div>
        <ChevronDown
          className="w-5 h-5 shrink-0 transition-transform duration-200"
          style={{
            color: '#c0ccda',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>

      {/* ECUE table — collapsible */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? '600px' : '0' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <th className="px-5 py-2 text-left text-xs font-medium" style={{ color: '#8392a5' }}>ECUE</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Cr.</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>CCC</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>ETS</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>S1</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>S2</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Moyenne</th>
                <th className="px-3 py-2 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {ue.ecueResults.map(ecue => (
                <ECUERow key={ecue.ecueCode} ecue={ecue} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ECUERow({ ecue }: { ecue: StudentECUEResult }) {
  const avg = ecue.average;
  const validated = ecue.validated;
  return (
    <tr className="border-b hover:bg-[#f9f9fd] transition-colors" style={{ borderColor: '#f3f6f9' }}>
      <td className="px-5 py-2.5">
        <span style={{ color: '#575d78' }}>{ecue.ecueName}</span>
        {!ecue.approved && (
          <span className="ml-2 text-xs" style={{ color: '#fca665' }} title="Notes non approuvées">*</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center" style={{ color: '#8392a5' }}>{ecue.credits}</td>
      <GradeCell value={ecue.ccc} />
      <GradeCell value={ecue.ets} />
      <GradeCell value={ecue.session1} />
      <GradeCell value={ecue.session2} />
      <td className="px-3 py-2.5 text-center">
        {avg !== null ? (
          <span className="font-bold" style={{ color: avg >= 10 ? '#22d273' : '#dc3545' }}>
            {avg.toFixed(2)}
          </span>
        ) : <span style={{ color: '#c0ccda' }}>—</span>}
      </td>
      <td className="px-3 py-2.5 text-center">
        {avg !== null && (
          validated
            ? <CheckCircle className="w-4 h-4 inline" style={{ color: '#22d273' }} />
            : <XCircle className="w-4 h-4 inline" style={{ color: '#dc3545' }} />
        )}
      </td>
    </tr>
  );
}

function GradeCell({ value }: { value: number | null }) {
  if (value === null) return <td className="px-3 py-2.5 text-center" style={{ color: '#c0ccda' }}>—</td>;
  return (
    <td className="px-3 py-2.5 text-center" style={{ color: '#575d78' }}>
      {value.toFixed(2)}
    </td>
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
