import { useState, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import type { Student, StudentStatus, SemesterView } from '../types';
import { StatusBadge } from './Dashboard';
import ExportButton from './ExportButton';
import type { ExportTableData } from '../utils/exportTable';

interface Props {
  students: Student[];
  onStudentClick: (student: Student) => void;
  hasBothSemesters?: boolean;
  semesterView?: SemesterView;
  onSemesterViewChange?: (v: SemesterView) => void;
}

type SortKey = 'rank' | 'name' | 'semesterAverage' | 's1Average' | 's2Average' | 'totalCredits' | 'status';
type SortDir = 'asc' | 'desc';

export default function StudentList({ students, onStudentClick, hasBothSemesters, semesterView, onSemesterViewChange }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'ALL'>('ALL');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'S1' | 'SR'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('semesterAverage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let list = [...students];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) || s.matricule.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'ALL') list = list.filter(s => s.status === statusFilter);
    if (sessionFilter !== 'ALL') list = list.filter(s => s.session === sessionFilter);
    list.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortKey === 's1Average') {
        va = a.s1Average ?? 0;
        vb = b.s1Average ?? 0;
      } else if (sortKey === 's2Average') {
        va = a.s2Average ?? 0;
        vb = b.s2Average ?? 0;
      } else {
        va = a[sortKey] ?? 0;
        vb = b[sortKey] ?? 0;
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [students, search, statusFilter, sessionFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ChevronDown className="w-3 h-3" style={{ color: '#c0ccda' }} />;

  // Show S1/S2 columns when viewing annual data
  const showTermColumns = hasBothSemesters && semesterView === 'ANNUAL';

  const getExportData = useCallback((): ExportTableData => {
    const cols = showTermColumns
      ? ['Rang', 'Matricule', 'Nom', 'Moy. S1', 'Moy. S2', 'Moyenne', 'Crédits', 'Statut', 'Session']
      : ['Rang', 'Matricule', 'Nom', 'Moyenne', 'Crédits', 'Statut', 'Session'];
    const rows = filtered.map(s => {
      const rankStr = `${s.rank === 1 ? '1er' : `${s.rank}e`}${s.isExAequo ? ' ex' : ''}`;
      const base = [rankStr, s.matricule, s.name];
      if (showTermColumns) {
        base.push(s.s1Average != null ? s.s1Average.toFixed(2) : '—');
        base.push(s.s2Average != null ? s.s2Average.toFixed(2) : '—');
      }
      base.push(s.semesterAverage.toFixed(2));
      base.push(`${s.totalCredits}/${s.ueResults.reduce((a, u) => a + u.totalCredits, 0)}`);
      base.push(s.status);
      base.push(s.session ?? 'S1');
      return base;
    });
    return { title: 'Liste des étudiants', columns: cols, rows, filename: 'liste_etudiants' };
  }, [filtered, showTermColumns]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-cassie p-4 flex flex-wrap gap-3 items-center">
        {/* Term toggle */}
        {hasBothSemesters && onSemesterViewChange && (
          <div className="flex items-center rounded p-0.5 shrink-0" style={{ background: '#f3f6f9' }}>
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
        )}
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c0ccda' }} />
          <input
            type="text"
            placeholder="Rechercher nom ou matricule…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded focus:outline-none focus:ring-2"
            style={{ borderColor: '#e6e7ef', color: '#373857' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StudentStatus | 'ALL')}
          className="cassie-select py-2 px-3 text-sm border rounded focus:outline-none"
          style={{ borderColor: '#e6e7ef', color: '#575d78' }}
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ADMIS">Admis</option>
          <option value="AUTORISÉ">Autorisés</option>
          <option value="AJOURNÉ">Ajournés</option>
        </select>
        <select
          value={sessionFilter}
          onChange={e => setSessionFilter(e.target.value as 'ALL' | 'S1' | 'SR')}
          className="cassie-select py-2 px-3 text-sm border rounded focus:outline-none"
          style={{ borderColor: '#e6e7ef', color: '#575d78' }}
        >
          <option value="ALL">Toutes sessions</option>
          <option value="S1">Session 1</option>
          <option value="SR">Session de Rattrapage</option>
        </select>
        <span className="text-xs ml-auto" style={{ color: '#8392a5' }}>{filtered.length}/{students.length}</span>
        <ExportButton getData={getExportData} />
      </div>

      {/* Table */}
      <div className="card-cassie overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f9f9fd' }}>
                <SortHeader label="Rang" k="rank" onSort={toggleSort} icon={<SortIcon k="rank" />} />
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Matricule</th>
                <SortHeader label="Nom" k="name" onSort={toggleSort} icon={<SortIcon k="name" />} />
                {showTermColumns && (
                  <SortHeader label="Moy. S1" k="s1Average" onSort={toggleSort} icon={<SortIcon k="s1Average" />} />
                )}
                {showTermColumns && (
                  <SortHeader label="Moy. S2" k="s2Average" onSort={toggleSort} icon={<SortIcon k="s2Average" />} />
                )}
                <SortHeader label={showTermColumns ? 'Moy. Annuelle' : 'Moyenne'} k="semesterAverage" onSort={toggleSort} icon={<SortIcon k="semesterAverage" />} />
                <SortHeader label="Crédits" k="totalCredits" onSort={toggleSort} icon={<SortIcon k="totalCredits" />} />
                <SortHeader label="Statut" k="status" onSort={toggleSort} icon={<SortIcon k="status" />} />
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Session</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Repêchage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.matricule}
                  className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                  style={{ borderColor: '#f3f6f9' }}
                  onClick={() => onStudentClick(s)}
                >
                  <td className="px-4 py-3 font-bold text-center" style={{ color: '#c0ccda' }}>
                    {s.rank === 1 ? '1er' : `${s.rank}e`}{s.isExAequo && <span className="text-[10px] ml-1" style={{ color: '#5556fd' }}>ex</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8392a5' }}>{s.matricule}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#06072d' }}>{s.name}</div>
                  </td>
                  {showTermColumns && (
                    <td className="px-4 py-3">
                      {s.s1Average != null ? (
                        <span className="font-medium" style={{ color: s.s1Average >= 10 ? '#22d273' : '#dc3545' }}>
                          {s.s1Average.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: '#c0ccda' }}>—</span>
                      )}
                    </td>
                  )}
                  {showTermColumns && (
                    <td className="px-4 py-3">
                      {s.s2Average != null ? (
                        <span className="font-medium" style={{ color: s.s2Average >= 10 ? '#22d273' : '#dc3545' }}>
                          {s.s2Average.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: '#c0ccda' }}>—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: s.semesterAverage >= 10 ? '#22d273' : '#dc3545' }}>
                      {s.semesterAverage.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 rounded-full" style={{
                        width: `${Math.round((s.totalCredits / Math.max(s.ueResults.reduce((acc, u) => acc + u.totalCredits, 0), 1)) * 48)}px`,
                        background: '#5556fd',
                        opacity: 0.5
                      }} />
                      <span style={{ color: '#575d78' }}>{s.totalCredits}/{s.ueResults.reduce((acc, u) => acc + u.totalCredits, 0)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-xs">
                    {s.session === 'SR' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: '#f0e6ff', color: '#7c3aed' }}>SR</span>
                    ) : <span style={{ color: '#8392a5' }}>S1</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.eligibleRepechage && (
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: '#fff5eb', color: '#b86e1d' }}>Éligible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: '#c0ccda' }}>Aucun étudiant trouvé</div>
        )}
      </div>
    </div>
  );
}

function SortHeader({ label, k, onSort, icon }: {
  label: string; k: SortKey;
  onSort: (k: SortKey) => void;
  icon: React.ReactNode;
}) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium cursor-pointer select-none hover:text-[#06072d]"
      style={{ color: '#8392a5' }}
      onClick={() => onSort(k)}
    >
      <div className="flex items-center gap-1">{label}{icon}</div>
    </th>
  );
}
