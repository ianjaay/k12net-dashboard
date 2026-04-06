import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import type { K12Student, PromotionStatus, TermView } from '../types/k12';
import { PromotionBadge, DistinctionBadge, SanctionBadge } from './Dashboard';
import ExportButton from './ExportButton';
import type { ExportTableData } from '../utils/exportTable';
import { useSession } from '../contexts/SessionContext';

interface Props {
  students: K12Student[];
  termView: TermView;
  onTermViewChange: (v: TermView) => void;
  onStudentClick: (student: K12Student) => void;
  onFilteredChange?: (matricules: string[]) => void;
}

type SortKey = 'rank' | 'name' | 'avg' | 'yearAvg' | 't1Avg' | 't2Avg' | 't3Avg' | 'status';
type SortDir = 'asc' | 'desc';

function getTermAvg(s: K12Student, tid: 'T1' | 'T2' | 'T3'): number | null {
  return s.yearResult?.termResults.find(t => t.termId === tid)?.termAverage ?? null;
}

function getTermRank(s: K12Student, tid: 'T1' | 'T2' | 'T3'): number | null {
  return s.yearResult?.termResults.find(t => t.termId === tid)?.rank ?? null;
}

function getAvgForView(s: K12Student, view: TermView): number | null {
  return view === 'ANNUAL' ? (s.yearResult?.yearAverage ?? null) : getTermAvg(s, view as 'T1' | 'T2' | 'T3');
}

function getRankForView(s: K12Student, view: TermView): number | null {
  return view === 'ANNUAL' ? (s.yearResult?.rank ?? null) : getTermRank(s, view as 'T1' | 'T2' | 'T3');
}

export default function StudentList({ students, termView, onTermViewChange, onStudentClick, onFilteredChange }: Props) {
  const { studentListFilters, setStudentListFilters } = useSession();

  // Derive local values from persisted filters
  const search = studentListFilters.search;
  const statusFilter = studentListFilters.statusFilter;
  const sortKey = studentListFilters.sortKey as SortKey;
  const sortDir = studentListFilters.sortDir as SortDir;
  const markMin = studentListFilters.markMin;
  const markMax = studentListFilters.markMax;
  const selectedDistSanc = useMemo(() => new Set(studentListFilters.selectedDistSanc), [studentListFilters.selectedDistSanc]);

  // Setters that update context
  const setSearch = useCallback((v: string) => setStudentListFilters({ ...studentListFilters, search: v }), [studentListFilters, setStudentListFilters]);
  const setStatusFilter = useCallback((v: PromotionStatus | 'ALL') => setStudentListFilters({ ...studentListFilters, statusFilter: v }), [studentListFilters, setStudentListFilters]);
  const setSortKey = useCallback((v: SortKey) => setStudentListFilters({ ...studentListFilters, sortKey: v }), [studentListFilters, setStudentListFilters]);
  const setSortDir = useCallback((v: SortDir) => setStudentListFilters({ ...studentListFilters, sortDir: v }), [studentListFilters, setStudentListFilters]);
  const setMarkMin = useCallback((v: number | null) => setStudentListFilters({ ...studentListFilters, markMin: v }), [studentListFilters, setStudentListFilters]);
  const setMarkMax = useCallback((v: number | null) => setStudentListFilters({ ...studentListFilters, markMax: v }), [studentListFilters, setStudentListFilters]);
  const setSelectedDistSanc = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const next = typeof updater === 'function' ? updater(new Set(studentListFilters.selectedDistSanc)) : updater;
    setStudentListFilters({ ...studentListFilters, selectedDistSanc: [...next] });
  }, [studentListFilters, setStudentListFilters]);

  const [distSancOpen, setDistSancOpen] = useState(false);
  const distSancRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (distSancRef.current && !distSancRef.current.contains(e.target as Node)) setDistSancOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDistSanc = (val: string) => {
    setSelectedDistSanc(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };

  const DIST_OPTIONS: { value: string; label: string; color: string }[] = [
    { value: 'THF', label: 'THF', color: '#22d273' },
    { value: 'THFR', label: 'THFR', color: '#86efac' },
    { value: 'THE', label: 'THE', color: '#5556fd' },
    { value: 'THER', label: 'THER', color: '#a5b4fc' },
    { value: 'TH', label: 'TH', color: '#ffc107' },
    { value: 'THR', label: 'THR', color: '#c8a44a' },
  ];
  const SANC_OPTIONS: { value: string; label: string; color: string }[] = [
    { value: 'BTI', label: 'BTI', color: '#dc3545' },
    { value: 'AVT', label: 'AVT', color: '#fca665' },
    { value: 'BMC', label: 'BMC', color: '#7c3aed' },
    { value: 'AMC', label: 'AMC', color: '#c084fc' },
  ];

  const filtered = useMemo(() => {
    let list = [...students];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.fullName.toLowerCase().includes(q) || s.matricule.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'ALL') list = list.filter(s => s.yearResult?.promotionStatus === statusFilter);

    // Mark range filter
    if (markMin != null || markMax != null) {
      list = list.filter(s => {
        const avg = getAvgForView(s, termView);
        if (avg == null) return false;
        if (markMin != null && avg < markMin) return false;
        if (markMax != null && avg > markMax) return false;
        return true;
      });
    }

    // Distinction/Sanction filter
    if (selectedDistSanc.size > 0) {
      list = list.filter(s => {
        const yr = s.yearResult;
        if (!yr) return false;
        if (termView === 'ANNUAL') {
          const dist = yr.termResults.slice().reverse().find(t => t.distinction != null)?.distinction;
          const sanc = yr.termResults.slice().reverse().find(t => t.sanction != null)?.sanction;
          return (dist != null && selectedDistSanc.has(dist)) || (sanc != null && selectedDistSanc.has(sanc));
        }
        const tr = yr.termResults.find(t => t.termId === termView);
        return (tr?.distinction != null && selectedDistSanc.has(tr.distinction)) || (tr?.sanction != null && selectedDistSanc.has(tr.sanction));
      });
    }

    // For term views, only show students with data for that term
    if (termView !== 'ANNUAL') {
      const tid = termView as 'T1' | 'T2' | 'T3';
      list = list.filter(s => getTermAvg(s, tid) != null);
    }

    list.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortKey === 'name') { va = a.fullName.toLowerCase(); vb = b.fullName.toLowerCase(); }
      else if (sortKey === 'avg') { va = getAvgForView(a, termView) ?? 0; vb = getAvgForView(b, termView) ?? 0; }
      else if (sortKey === 'yearAvg') { va = a.yearResult?.yearAverage ?? 0; vb = b.yearResult?.yearAverage ?? 0; }
      else if (sortKey === 't1Avg') { va = getTermAvg(a, 'T1') ?? 0; vb = getTermAvg(b, 'T1') ?? 0; }
      else if (sortKey === 't2Avg') { va = getTermAvg(a, 'T2') ?? 0; vb = getTermAvg(b, 'T2') ?? 0; }
      else if (sortKey === 't3Avg') { va = getTermAvg(a, 'T3') ?? 0; vb = getTermAvg(b, 'T3') ?? 0; }
      else if (sortKey === 'rank') { va = getRankForView(a, termView) ?? 999; vb = getRankForView(b, termView) ?? 999; }
      else if (sortKey === 'status') { va = a.yearResult?.promotionStatus ?? ''; vb = b.yearResult?.promotionStatus ?? ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [students, search, statusFilter, markMin, markMax, selectedDistSanc, sortKey, sortDir, termView]);

  // Report filtered list to parent for prev/next navigation
  useEffect(() => {
    onFilteredChange?.(filtered.map(s => s.matricule));
  }, [filtered, onFilteredChange]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ChevronDown className="w-3 h-3" style={{ color: '#c0ccda' }} />;

  const getExportData = useCallback((): ExportTableData => {
    if (termView === 'ANNUAL') {
      const cols = ['Rang', 'Matricule', 'Nom', 'Moy. T1', 'Moy. T2', 'Moy. T3', 'Moy. Annuelle', 'Statut', 'Filière'];
      const rows = filtered.map(s => [
        s.yearResult?.rank ?? '—',
        s.matricule,
        s.fullName,
        getTermAvg(s, 'T1')?.toFixed(2) ?? '—',
        getTermAvg(s, 'T2')?.toFixed(2) ?? '—',
        getTermAvg(s, 'T3')?.toFixed(2) ?? '—',
        s.yearResult?.yearAverage?.toFixed(2) ?? '—',
        s.yearResult?.promotionStatus ?? '—',
        s.branch ?? '—',
      ]);
      return { title: 'Liste des élèves — Annuel', columns: cols, rows, filename: 'liste_eleves_annuel' };
    }
    const tid = termView as 'T1' | 'T2' | 'T3';
    const cols = ['Rang', 'Matricule', 'Nom', `Moyenne ${tid}`, 'Distinction', 'Sanction'];
    const rows = filtered.map(s => {
      const tr = s.yearResult?.termResults.find(t => t.termId === tid);
      return [
        tr?.rank ?? '—',
        s.matricule,
        s.fullName,
        tr?.termAverage?.toFixed(2) ?? '—',
        tr?.distinction ?? '—',
        tr?.sanction ?? '—',
      ];
    });
    return { title: `Liste des élèves — ${tid}`, columns: cols, rows, filename: `liste_eleves_${tid.toLowerCase()}` };
  }, [filtered, termView]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-cassie p-4 flex flex-wrap gap-3 items-center">
        {/* Term toggle */}
        <div className="flex items-center rounded p-0.5 shrink-0" style={{ background: '#f3f6f9' }}>
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
        {termView === 'ANNUAL' && (
          <select
            value={statusFilter ?? 'ALL'}
            onChange={e => setStatusFilter(e.target.value === 'ALL' ? 'ALL' : e.target.value as PromotionStatus)}
            className="cassie-select py-2 px-3 text-sm border rounded focus:outline-none"
            style={{ borderColor: '#e6e7ef', color: '#575d78' }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ADMIS">Admis</option>
            <option value="REDOUBLE">Redouble</option>
            <option value="EXCLU">Exclu</option>
          </select>
        )}

        {/* Mark range filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-medium" style={{ color: '#8392a5' }}>Moy.</span>
          <input
            type="number" min={0} max={20} step={0.5}
            value={markMin ?? ''} placeholder="Min"
            onChange={e => setMarkMin(e.target.value === '' ? null : Number(e.target.value))}
            className="text-xs font-medium rounded px-2 py-1.5 border w-14 text-center focus:outline-none focus:ring-1"
            style={{ borderColor: '#e6e7ef', color: '#5556fd', background: '#f9f9fd' }}
          />
          <span className="text-[10px]" style={{ color: '#c0ccda' }}>–</span>
          <input
            type="number" min={0} max={20} step={0.5}
            value={markMax ?? ''} placeholder="Max"
            onChange={e => setMarkMax(e.target.value === '' ? null : Number(e.target.value))}
            className="text-xs font-medium rounded px-2 py-1.5 border w-14 text-center focus:outline-none focus:ring-1"
            style={{ borderColor: '#e6e7ef', color: '#5556fd', background: '#f9f9fd' }}
          />
        </div>

        {/* Distinction / Sanction multi-select */}
        <div className="relative" ref={distSancRef}>
          <button
            onClick={() => setDistSancOpen(!distSancOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded transition-colors"
            style={{
              borderColor: selectedDistSanc.size > 0 ? '#5556fd' : '#e6e7ef',
              color: selectedDistSanc.size > 0 ? '#5556fd' : '#575d78',
              background: selectedDistSanc.size > 0 ? '#f0f0ff' : '#fff',
            }}
          >
            <Filter className="w-3.5 h-3.5" />
            {selectedDistSanc.size > 0 ? `${selectedDistSanc.size} sélection(s)` : 'Dist. / Sanct.'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {distSancOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-lg py-1 w-44" style={{ borderColor: '#e6e7ef' }}>
              <p className="text-[9px] uppercase tracking-widest font-medium px-3 py-1" style={{ color: '#8392a5' }}>Distinctions</p>
              {DIST_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9f9fd] cursor-pointer text-xs" style={{ color: '#575d78' }}>
                  <input
                    type="checkbox"
                    checked={selectedDistSanc.has(opt.value)}
                    onChange={() => toggleDistSanc(opt.value)}
                    className="rounded"
                  />
                  <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                  {opt.label}
                </label>
              ))}
              <hr className="my-1" style={{ borderColor: '#e6e7ef' }} />
              <p className="text-[9px] uppercase tracking-widest font-medium px-3 py-1" style={{ color: '#8392a5' }}>Sanctions</p>
              {SANC_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9f9fd] cursor-pointer text-xs" style={{ color: '#575d78' }}>
                  <input
                    type="checkbox"
                    checked={selectedDistSanc.has(opt.value)}
                    onChange={() => toggleDistSanc(opt.value)}
                    className="rounded"
                  />
                  <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                  {opt.label}
                </label>
              ))}
              {selectedDistSanc.size > 0 && (
                <>
                  <hr className="my-1" style={{ borderColor: '#e6e7ef' }} />
                  <button
                    onClick={() => { setSelectedDistSanc(new Set()); setDistSancOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#fce8ea] transition-colors"
                    style={{ color: '#dc3545' }}
                  >
                    Effacer tout
                  </button>
                </>
              )}
            </div>
          )}
        </div>
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
                <SortHeader label="Élève" k="name" onSort={toggleSort} icon={<SortIcon k="name" />} />
                {termView === 'ANNUAL' ? (
                  <>
                    <SortHeader label="Moy. T1" k="t1Avg" onSort={toggleSort} icon={<SortIcon k="t1Avg" />} />
                    <SortHeader label="Moy. T2" k="t2Avg" onSort={toggleSort} icon={<SortIcon k="t2Avg" />} />
                    <SortHeader label="Moy. T3" k="t3Avg" onSort={toggleSort} icon={<SortIcon k="t3Avg" />} />
                    <SortHeader label="Moy. Annuelle" k="yearAvg" onSort={toggleSort} icon={<SortIcon k="yearAvg" />} />
                    <SortHeader label="Statut" k="status" onSort={toggleSort} icon={<SortIcon k="status" />} />
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#8392a5' }}>Filière</th>
                  </>
                ) : (
                  <>
                    <SortHeader label={`Moyenne ${termView}`} k="avg" onSort={toggleSort} icon={<SortIcon k="avg" />} />
                    <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Distinction</th>
                    <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: '#8392a5' }}>Sanction</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const yr = s.yearResult;
                const activeTermResult = termView !== 'ANNUAL'
                  ? yr?.termResults.find(t => t.termId === termView)
                  : null;
                const displayRank = termView === 'ANNUAL' ? yr?.rank : activeTermResult?.rank;
                const displayTotal = termView === 'ANNUAL' ? yr?.totalStudents : activeTermResult?.totalStudents;
                // For ANNUAL view, pick latest term with data for distinction/sanction
                const displayDistinction = termView !== 'ANNUAL'
                  ? (activeTermResult?.distinction ?? null)
                  : (yr?.termResults.slice().reverse().find(t => t.distinction != null)?.distinction ?? null);
                const displaySanction = termView !== 'ANNUAL'
                  ? (activeTermResult?.sanction ?? null)
                  : (yr?.termResults.slice().reverse().find(t => t.sanction != null)?.sanction ?? null);
                return (
                  <tr
                    key={s.id}
                    className="border-b cursor-pointer hover:bg-[#f9f9fd] transition-colors"
                    style={{ borderColor: '#f3f6f9' }}
                    onClick={() => onStudentClick(s)}
                  >
                    <td className="px-4 py-3 text-center" style={{ color: '#575d78' }}>
                      {displayRank != null ? (
                        <span className="font-bold" style={{ color: '#06072d' }}>{displayRank}</span>
                      ) : '—'}
                      {displayTotal != null && displayRank != null && (
                        <span className="text-[10px] ml-0.5" style={{ color: '#c0ccda' }}>/{displayTotal}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#06072d' }}>{s.fullName}</div>
                      <div className="text-xs" style={{ color: '#8392a5' }}>
                        <span className="font-mono">{s.matricule}</span> · {s.className}
                      </div>
                    </td>
                    {termView === 'ANNUAL' ? (
                      <>
                        <AvgCell value={getTermAvg(s, 'T1')} />
                        <AvgCell value={getTermAvg(s, 'T2')} />
                        <AvgCell value={getTermAvg(s, 'T3')} />
                        <td className="px-4 py-3">
                          <span className="font-bold" style={{ color: (yr?.yearAverage ?? 0) >= 10 ? '#22d273' : '#dc3545' }}>
                            {yr?.yearAverage?.toFixed(2) ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><PromotionBadge status={yr?.promotionStatus ?? null} /></td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#575d78' }}>{s.branch ?? '—'}</td>
                      </>
                    ) : (
                      <>
                        <AvgCell value={getTermAvg(s, termView as 'T1' | 'T2' | 'T3')} />
                        <td className="px-4 py-3 text-center">
                          <DistinctionBadge distinction={displayDistinction} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <SanctionBadge sanction={displaySanction} />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: '#c0ccda' }}>Aucun élève trouvé</div>
        )}
      </div>
    </div>
  );
}

function AvgCell({ value }: { value: number | null }) {
  if (value == null) return <td className="px-4 py-3" style={{ color: '#c0ccda' }}>—</td>;
  return (
    <td className="px-4 py-3">
      <span className="font-medium" style={{ color: value >= 10 ? '#22d273' : '#dc3545' }}>
        {value.toFixed(2)}
      </span>
    </td>
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
