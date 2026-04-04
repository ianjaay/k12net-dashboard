import { useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useSession } from '../../contexts/SessionContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { parseGradesExcel } from '../../utils/gradesParser';
import { buildSubjectsByClass } from '../../utils/sectionListParser';
import { processClass, getRulesForYear } from '../../utils/k12RulesEngine';
import type { K12AppData, K12Class, K12Student, AcademicYear } from '../../types/k12';

export default function AdminRoute() {
  const { userRole, sessionId, appData, handleK12DataReady } = useSession();
  const { settings } = useGlobalSettings();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ classes: number; students: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (userRole === 'reader') {
    return <Navigate to={`/sessions/${sessionId}/dashboard`} replace />;
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setImportResult(null);
    setImporting(true);

    try {
      const buf = await file.arrayBuffer();

      // Build subject map from course catalog if available
      const subjectsByClass = settings.courseCatalog
        ? buildSubjectsByClass(settings.courseCatalog)
        : undefined;

      // Parse grades Excel
      const classes = parseGradesExcel(buf, subjectsByClass);
      if (classes.length === 0) {
        throw new Error('Aucune classe trouvée dans le fichier. Vérifiez que le format correspond à l\'export K12net des moyennes.');
      }

      // Determine academic year and rules
      const academicYear: AcademicYear = settings.academicYear ?? '2024';
      const rulesConfig = settings.rulesConfig ?? getRulesForYear(academicYear, settings.yearConfigs);

      // Run rules engine on each class
      const processedClasses: K12Class[] = classes.map(cls => ({
        ...cls,
        students: processClass(cls.students, rulesConfig),
      }));

      // Flatten all students
      const allStudents: K12Student[] = processedClasses.flatMap(c => c.students);

      // Build K12AppData
      const data: K12AppData = {
        academicYear,
        rulesConfig,
        schoolName: settings.schoolName ?? 'Lycée Sainte Marie de Cocody',
        classes: processedClasses,
        courseCatalog: settings.courseCatalog ?? [],
        students: allStudents,
      };

      await handleK12DataReady(data);
      setImportResult({ classes: processedClasses.length, students: allStudents.length });
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue lors de l\'import');
    } finally {
      setImporting(false);
    }
  }, [settings, handleK12DataReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      handleFile(file);
    } else {
      setError('Veuillez déposer un fichier .xlsx');
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const hasData = !!appData && appData.students.length > 0;

  return (
    <div className="space-y-6">
      <div className="card-cassie p-6">
        <h3 className="text-lg font-semibold mb-1" style={{ color: '#06072d' }}>Import des données</h3>
        <p className="text-sm mb-5" style={{ color: '#8392a5' }}>
          Importez le fichier Excel des moyennes exporté depuis K12net (format .xlsx, un onglet par classe).
        </p>

        {/* Warning if no course catalog */}
        {!settings.courseCatalog && (
          <div className="flex items-start gap-3 p-3 rounded-lg mb-5" style={{ background: '#fffdf0', border: '1px solid #f5e6a3' }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#c5941a' }} />
            <p className="text-xs" style={{ color: '#7a6520' }}>
              Aucun catalogue de matières chargé. Les coefficients ne seront pas disponibles pour le calcul des moyennes pondérées.
              Vous pouvez importer la liste des sections depuis la page <strong>Administration globale</strong>.
            </p>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors hover:border-[#5556fd] hover:bg-[#f8f8ff]"
          style={{ borderColor: importing ? '#5556fd' : '#e6e7ef' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleInputChange}
          />
          {importing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#5556fd' }} />
              <p className="text-sm font-medium" style={{ color: '#5556fd' }}>Import en cours…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f0f0ff' }}>
                <Upload className="w-7 h-7" style={{ color: '#5556fd' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: '#06072d' }}>
                  {hasData ? 'Remplacer les données' : 'Déposez le fichier des moyennes ici'}
                </p>
                <p className="text-xs" style={{ color: '#8392a5' }}>
                  ou cliquez pour sélectionner un fichier .xlsx
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-lg mt-4" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
            <p className="text-xs" style={{ color: '#991b1b' }}>{error}</p>
          </div>
        )}

        {/* Success */}
        {importResult && (
          <div className="flex items-start gap-3 p-3 rounded-lg mt-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#16a34a' }} />
            <p className="text-xs" style={{ color: '#166534' }}>
              Import réussi : <strong>{importResult.classes}</strong> classe{importResult.classes > 1 ? 's' : ''}, <strong>{importResult.students}</strong> élève{importResult.students > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Current data summary */}
      {hasData && (
        <div className="card-cassie p-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#06072d' }}>Données chargées</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg" style={{ background: '#f9f9fd' }}>
              <p className="text-2xl font-bold" style={{ color: '#5556fd' }}>{appData!.classes.length}</p>
              <p className="text-[11px]" style={{ color: '#8392a5' }}>Classes</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#f9f9fd' }}>
              <p className="text-2xl font-bold" style={{ color: '#5556fd' }}>{appData!.students.length}</p>
              <p className="text-[11px]" style={{ color: '#8392a5' }}>Élèves</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#f9f9fd' }}>
              <p className="text-2xl font-bold" style={{ color: '#5556fd' }}>{appData!.academicYear}</p>
              <p className="text-[11px]" style={{ color: '#8392a5' }}>Année</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#f9f9fd' }}>
              <p className="text-2xl font-bold" style={{ color: '#5556fd' }}>{appData!.rulesConfig.academicYear}</p>
              <p className="text-[11px]" style={{ color: '#8392a5' }}>Règles</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium mb-2" style={{ color: '#8392a5' }}>Classes importées</p>
            <div className="flex flex-wrap gap-2">
              {appData!.classes.map(c => (
                <span key={c.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#f0f0ff', color: '#5556fd' }}>
                  {c.displayName || c.name} ({c.students.length})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
