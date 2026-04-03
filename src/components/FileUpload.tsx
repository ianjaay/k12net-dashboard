import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseGradeDistributionAllSheets, DEFAULT_TERM_CONFIG } from '../utils/excelParser';
import { calculateStudents, calculateAllClasses } from '../utils/calculator';
import type { AppData, ParsedExcel, CourseStructure, ValidationRules } from '../types';
import { DEFAULT_VALIDATION_RULES } from '../types';

interface Props {
  onDataReady: (data: AppData) => void | Promise<void>;
  courses?: CourseStructure | null;
  validationRules?: ValidationRules;
}

export interface FileState {
  file: File | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  error?: string;
  info?: string;
}

function buildAppData(
  parsedSheets: ParsedExcel[] | null,
  courses: CourseStructure | null,
  rules: ValidationRules = DEFAULT_VALIDATION_RULES,
): Partial<AppData> {
  if (!parsedSheets || !courses) {
    return { parsedExcel: parsedSheets?.[0] ?? null, courses };
  }

  if (parsedSheets.length === 1) {
    // Single-class mode (backward compatible)
    const students = calculateStudents(parsedSheets[0], courses, rules);
    return {
      courses,
      parsedExcel: parsedSheets[0],
      students,
      multiClass: null,
      creditOverrides: [],
      termConfig: DEFAULT_TERM_CONFIG,
    };
  }

  // Multi-class mode
  const multiClass = calculateAllClasses(parsedSheets, courses, [], rules);

  return {
    courses,
    parsedExcel: multiClass.classes[0].parsedExcel,
    students: multiClass.classes[0].students,
    multiClass,
    creditOverrides: [],
    termConfig: DEFAULT_TERM_CONFIG,
  };
}

export default function FileUpload({ onDataReady, courses: globalCourses, validationRules }: Props) {
  const [gradeFile, setGradeFile] = useState<FileState>({ file: null, status: 'idle' });
  const [processing, setProcessing] = useState(false);
  const [appData, setAppData] = useState<Partial<AppData>>({});

  const activeCourses = globalCourses ?? null;

  const handleFileDrop = useCallback(
    async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      const file =
        'dataTransfer' in e ? e.dataTransfer.files[0] : e.target.files?.[0];
      if (!file) return;

      setGradeFile({ file, status: 'loading' });
      try {
        const sheets = await parseGradeDistributionAllSheets(file);
        const totalStudents = sheets.reduce((s, p) => s + p.studentRows.length, 0);
        const uniqueGroups = new Set(sheets.map(s => s.groupName)).size;
        const hasMultipleTerms = new Set(sheets.flatMap(s => s.availableTerms)).size > 1;
        let info: string;
        if (sheets.length > 1) {
          info = `${uniqueGroups} classe(s) · ${totalStudents} etudiants`;
          if (hasMultipleTerms) info += ' · S1 + S2';
        } else {
          info = `${totalStudents} etudiants · ${sheets[0].ecueColumns.length} ECUEs`;
        }
        setGradeFile({ file, status: 'done', info });
        const data = buildAppData(sheets, activeCourses, validationRules);
        setAppData(data);
      } catch (err) {
        setGradeFile({ file, status: 'error', error: String(err) });
      }
    },
    [activeCourses, validationRules]
  );

  const canProceed =
    gradeFile.status === 'done' && !!activeCourses && appData.students;

  const handleProceed = () => {
    if (canProceed) {
      setProcessing(true);
      onDataReady(appData as AppData);
    }
  };

  // Summary info
  const summaryText = (() => {
    if (!appData.students) return null;
    if (appData.multiClass) {
      const mc = appData.multiClass;
      const totalStudents = mc.classes.reduce((s, c) => s + c.students.length, 0);
      return `${mc.classes.length} classes chargees · ${totalStudents} etudiants au total · ${mc.allFilieres.join(', ')}`;
    }
    return `${appData.students.length} etudiants charges · ${appData.parsedExcel?.ecueColumns.length} ECUEs`;
  })();

  const noCourses = !activeCourses;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f9f9fd' }}>
      <div className="card-cassie w-full max-w-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#f0f0ff' }}>
            <FileSpreadsheet className="w-8 h-8" style={{ color: '#5556fd' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#06072d' }}>Tableau de Bord — Conseil de Classe</h1>
          <p className="mt-1" style={{ color: '#8392a5' }}>EMSP Abidjan · FS MENUM</p>
        </div>

        {noCourses && (
          <div className="mb-4 p-3 rounded text-sm" style={{ background: '#fff8e1', border: '1px solid #ffc107', color: '#b86e1d' }}>
            &#9888; La liste des cours n'a pas encore été chargée par un administrateur.
            Contactez un administrateur pour charger le fichier Section List dans les paramètres globaux.
          </div>
        )}

        {activeCourses && (
          <div className="mb-4 p-3 rounded text-sm flex items-center gap-2" style={{ background: '#e6f9ef', border: '1px solid #c3e6cb', color: '#1a8a4d' }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Liste des cours chargée — {Object.keys(activeCourses.ues).length} UEs · {Object.keys(activeCourses.ecues).length} ECUEs
          </div>
        )}

        <div className="space-y-4">
          <DropZone
            label="Releve de notes (Grade Distribution Report)"
            hint="Fichier Excel des resultats etudiants (une ou plusieurs feuilles)"
            state={gradeFile}
            onDrop={handleFileDrop}
          />
        </div>

        {summaryText && (
          <div className="mt-4 p-3 rounded text-sm" style={{ background: '#e6f9ef', border: '1px solid #c3e6cb', color: '#1a8a4d' }}>
            &#10003; {summaryText}
          </div>
        )}

        <button
          onClick={handleProceed}
          disabled={!canProceed || processing}
          className="mt-6 w-full py-3 px-6 text-white font-semibold rounded transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
          style={{ background: '#5556fd' }}
        >
          {processing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
          ) : (
            'Acceder au tableau de bord \u2192'
          )}
        </button>
      </div>
    </div>
  );
}

export function DropZone({
  label, hint, state, onDrop,
}: {
  label: string;
  hint: string;
  state: FileState;
  onDrop: (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const statusIcon = {
    idle: <Upload className="w-6 h-6" style={{ color: '#c0ccda' }} />,
    loading: <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5556fd' }} />,
    done: <CheckCircle className="w-6 h-6" style={{ color: '#22d273' }} />,
    error: <AlertCircle className="w-6 h-6" style={{ color: '#dc3545' }} />,
  }[state.status];

  const borderStyle: React.CSSProperties = {
    idle: dragging
      ? { borderColor: '#5556fd', background: '#f0f0ff' }
      : { borderColor: '#e6e7ef', background: 'white' },
    loading: { borderColor: '#5556fd', background: '#f0f0ff' },
    done: { borderColor: '#22d273', background: '#e6f9ef' },
    error: { borderColor: '#dc3545', background: '#fce8ea' },
  }[state.status];

  return (
    <label
      className="block border-2 border-dashed rounded p-5 cursor-pointer transition-all"
      style={borderStyle}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { setDragging(false); onDrop(e); }}
    >
      <input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onDrop as React.ChangeEventHandler<HTMLInputElement>}
      />
      <div className="flex items-center gap-4">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm" style={{ color: '#06072d' }}>{label}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#8392a5' }}>
            {state.file ? state.file.name : hint}
          </p>
          {state.info && (
            <p className="text-xs mt-0.5" style={{ color: '#5556fd' }}>{state.info}</p>
          )}
          {state.error && (
            <p className="text-xs mt-1" style={{ color: '#dc3545' }}>{state.error}</p>
          )}
        </div>
      </div>
    </label>
  );
}
