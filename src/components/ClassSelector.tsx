import type { ClassInfo, ClassPair, SemesterView } from '../types';
import { normalizeSemester } from '../utils/excelParser';

interface Props {
  classes: ClassInfo[];
  classPairs: ClassPair[];
  allNiveaux: string[];
  allFilieres: string[];
  selectedIndex: number;
  filterNiveau: string;
  filterFiliere: string;
  semesterView: SemesterView;
  hasBothSemesters: boolean;
  onSelectClass: (index: number) => void;
  onFilterNiveau: (v: string) => void;
  onFilterFiliere: (v: string) => void;
  onSemesterViewChange: (v: SemesterView) => void;
}

export default function ClassSelector({
  classes,
  classPairs,
  allNiveaux,
  allFilieres,
  selectedIndex,
  filterNiveau,
  filterFiliere,
  semesterView,
  hasBothSemesters,
  onSelectClass,
  onFilterNiveau,
  onFilterFiliere,
  onSemesterViewChange,
}: Props) {
  const isAnnual = semesterView === 'ANNUAL';

  const filteredClasses = isAnnual
    ? []
    : classes.filter(c => {
        const sem = normalizeSemester(c.semester);
        if (sem && sem !== semesterView) return false;
        return (filterNiveau === 'ALL' || c.niveau === filterNiveau) &&
          (filterFiliere === 'ALL' || c.filiere === filterFiliere);
      });

  const filteredPairs = isAnnual
    ? classPairs.filter(p =>
        (filterNiveau === 'ALL' || p.niveau === filterNiveau) &&
        (filterFiliere === 'ALL' || p.filiere === filterFiliere)
      )
    : [];

  const itemCount = isAnnual ? filteredPairs.length : filteredClasses.length;
  const totalCount = isAnnual ? classPairs.length : classes.length;
  const safeIndex = Math.min(selectedIndex, Math.max(itemCount - 1, 0));

  const totalStudents = isAnnual
    ? filteredPairs.reduce((s, p) => s + p.annualStudents.length, 0)
    : filteredClasses.reduce((s, c) => s + c.students.length, 0);

  return (
    <div className="bg-white border-b" style={{ borderColor: '#e6e7ef' }}>
      <div className="px-5">
        <div className="flex items-center gap-4 h-12 text-sm overflow-x-auto">
          {/* Semester toggle */}
          {hasBothSemesters && (
            <>
              <div className="flex items-center rounded p-0.5 shrink-0" style={{ background: '#f3f6f9' }}>
                {(['S1', 'S2', 'ANNUAL'] as const).map(sv => (
                  <button
                    key={sv}
                    onClick={() => { onSemesterViewChange(sv); onSelectClass(0); }}
                    className="px-3 py-1 text-xs font-medium rounded transition-all"
                    style={semesterView === sv
                      ? { background: '#5556fd', color: 'white' }
                      : { color: '#575d78' }
                    }
                  >
                    {sv === 'ANNUAL' ? 'Annuel' : sv}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px shrink-0" style={{ background: '#e6e7ef' }} />
            </>
          )}

          {/* Niveau filter */}
          <FilterDropdown
            label="Niveau"
            value={filterNiveau}
            options={allNiveaux}
            onChange={(v) => { onFilterNiveau(v); onSelectClass(0); }}
          />

          {/* Filiere filter */}
          <FilterDropdown
            label="Filiere"
            value={filterFiliere}
            options={allFilieres}
            onChange={(v) => { onFilterFiliere(v); onSelectClass(0); }}
          />

          <div className="h-5 w-px shrink-0" style={{ background: '#e6e7ef' }} />

          {/* Class selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium" style={{ color: '#8392a5' }}>Classe :</span>
            <div className="relative">
              <select
                value={safeIndex}
                onChange={(e) => onSelectClass(Number(e.target.value))}
                className="cassie-select text-xs font-medium pl-3 pr-7 py-1.5 rounded cursor-pointer transition-all focus:outline-none"
                style={{
                  background: '#f0f0ff',
                  color: '#5556fd',
                  border: '1px solid #d4d4ff',
                }}
              >
                {itemCount > 1 && (
                  <option value={-1}>
                    Toutes les classes ({totalStudents} etud.)
                  </option>
                )}
                {isAnnual
                  ? filteredPairs.map((p, i) => (
                      <option key={`${p.groupName}-${i}`} value={i}>
                        {p.groupName} ({p.annualStudents.length} etud.)
                      </option>
                    ))
                  : filteredClasses.map((c, i) => (
                      <option key={`${c.sheetName}-${i}`} value={i}>
                        {c.groupName} ({c.students.length} etud.)
                      </option>
                    ))}
                {itemCount === 0 && (
                  <option value={0} disabled>Aucune classe</option>
                )}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="ml-auto shrink-0">
            <span className="text-[11px]" style={{ color: '#8392a5' }}>
              {itemCount}/{totalCount} classes · {totalStudents} etudiants
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-medium" style={{ color: '#8392a5' }}>{label} :</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="cassie-select text-xs font-medium pl-3 pr-7 py-1.5 rounded cursor-pointer transition-all focus:outline-none"
          style={{
            background: '#f3f6f9',
            color: '#373857',
            border: '1px solid #e6e7ef',
          }}
        >
          <option value="ALL">Tous</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
