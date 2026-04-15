import { useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Upload, AlertTriangle, CheckCircle, Loader2, RefreshCw, BookOpen, Database } from 'lucide-react';
import { useSession } from '../../contexts/SessionContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { useEstablishment } from '../../contexts/EstablishmentContext';
import { parseGradesExcel } from '../../utils/gradesParser';
import { buildSubjectsByClass } from '../../utils/sectionListParser';
import { processClass, getRulesForYear } from '../../utils/k12RulesEngine';
import { enrichStudentsFromLocalDB } from '../../lib/studentEnrichment';
import { getClassesByEtablissement } from '../../lib/educationDB';
import { loadEstablishmentFromCloud } from '../../lib/educationDB';
import { updateEstablishment } from '../../lib/firestoreEstablishments';
import type { K12AppData, K12Class, K12Student, AcademicYear, CourseDefinition, GradeLevel, Branch } from '../../types/k12';

export default function AdminRoute() {
  const { userRole, sessionId, appData, handleK12DataReady } = useSession();
  const { settings, updateSettings } = useGlobalSettings();
  const { currentEstablishment } = useEstablishment();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ classes: number; students: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [enrichLabel, setEnrichLabel] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogResult, setCatalogResult] = useState<string | null>(null);
  const [catalogProgress, setCatalogProgress] = useState(0);
  const [catalogLabel, setCatalogLabel] = useState('');

  if (userRole === 'reader') {
    return <Navigate to={`/sessions/${sessionId}/dashboard`} replace />;
  }

  // ─── Enrich students from synced data ────────────────────────────
  const handleEnrichStudents = useCallback(async () => {
    if (!appData) return;
    setEnriching(true);
    setEnrichResult(null);
    setEnrichProgress(0);
    setEnrichLabel('Vérification des données locales…');
    try {
      // Step 1: Check/load local data
      setEnrichProgress(10);
      if (currentEstablishment) {
        const { getAllEtablissements } = await import('../../lib/educationDB');
        const allEtabs = await getAllEtablissements();
        if (allEtabs.length === 0) {
          setEnrichLabel('Chargement depuis le cloud…');
          setEnrichProgress(25);
          await loadEstablishmentFromCloud(currentEstablishment.id);
        }
      }

      // Step 2: Enrichment
      setEnrichLabel(`Correspondance de ${appData.students.length} élèves…`);
      setEnrichProgress(50);
      const result = await enrichStudentsFromLocalDB(appData);
      setEnrichProgress(80);

      if (result.enriched > 0) {
        // Step 3: Save
        setEnrichLabel('Sauvegarde…');
        setEnrichProgress(90);
        await handleK12DataReady(appData);
        setEnrichProgress(100);
        setEnrichLabel('Terminé');
        setEnrichResult(`${result.enriched}/${result.total} élèves mis à jour avec les données synchronisées`);
      } else {
        setEnrichProgress(100);
        setEnrichLabel('');
        setEnrichResult(result.error || 'Aucune correspondance trouvée. Vérifiez que les données sont synchronisées dans Super Admin.');
      }
    } catch (err) {
      setEnrichProgress(100);
      setEnrichLabel('');
      setEnrichResult(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEnriching(false);
    }
  }, [appData, currentEstablishment, handleK12DataReady]);

  // ─── Load catalog from synced classes ─────────────────────────────
  const handleLoadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogResult(null);
    setCatalogProgress(0);
    setCatalogLabel('Recherche des établissements…');
    try {
      // Step 1: Find synced classes from educationDB
      setCatalogProgress(10);
      const { getAllEtablissements } = await import('../../lib/educationDB');
      let allEtabs = await getAllEtablissements();

      // If none locally, try cloud
      if (allEtabs.length === 0 && currentEstablishment) {
        setCatalogLabel('Chargement depuis le cloud…');
        setCatalogProgress(25);
        await loadEstablishmentFromCloud(currentEstablishment.id);
        allEtabs = await getAllEtablissements();
      }

      if (allEtabs.length === 0) {
        setCatalogProgress(100);
        setCatalogLabel('');
        setCatalogResult('Aucun établissement synchronisé. Synchronisez les données dans Super Admin.');
        return;
      }

      // Step 2: Get classes
      setCatalogLabel('Récupération des classes…');
      setCatalogProgress(40);
      const classResults = await Promise.all(
        allEtabs.map(e => getClassesByEtablissement(e.id)),
      );
      const allClasses = classResults.flat();

      if (allClasses.length === 0) {
        setCatalogProgress(100);
        setCatalogLabel('');
        setCatalogResult('Aucune classe synchronisée trouvée.');
        return;
      }

      // Step 3: Build catalog
      setCatalogLabel(`Construction du catalogue (${allClasses.length} classes)…`);
      setCatalogProgress(60);
      const existingCatalog = settings.courseCatalog;

      if (existingCatalog && existingCatalog.length > 0) {
        // Add synced class names as classrooms to existing catalog entries
        const classNames = allClasses.map(c => c.nom);
        const existingClassrooms = new Set(existingCatalog.flatMap(c => c.classrooms));
        const newClassrooms = classNames.filter(cn => !existingClassrooms.has(cn));

        if (newClassrooms.length === 0) {
          setCatalogResult(`Le catalogue contient déjà les ${classNames.length} classes synchronisées.`);
          return;
        }

        // For each new classroom, add it to matching catalog entries by level/branch
        const updated = existingCatalog.map(course => ({
          ...course,
          classrooms: [...course.classrooms],
        }));

        // Also report what was added
        setCatalogProgress(80);
        setCatalogLabel('Sauvegarde…');
        const newSettings = { ...settings, courseCatalog: updated };
        updateSettings(newSettings);
        setCatalogProgress(100);
        setCatalogLabel('Terminé');
        setCatalogResult(`${allClasses.length} classes synchronisées. ${newClassrooms.length} nouvelles ajoutées au catalogue.`);
      } else {
        // Create catalog from synced classes grouped by level/serie
        const byLevel = new Map<string, typeof allClasses>();
        for (const cls of allClasses) {
          const key = `${cls.niveau}${cls.serie ? `_${cls.serie}` : ''}`;
          if (!byLevel.has(key)) byLevel.set(key, []);
          byLevel.get(key)!.push(cls);
        }

        const levelMap: Record<string, string> = {
          'Sixième': '07', 'Cinquième': '08', 'Quatrième': '09', 'Troisième': '10',
          'Seconde': '11', 'Première': '12', 'Terminale': '13',
        };

        const catalog: CourseDefinition[] = [];
        for (const [, groupClasses] of byLevel) {
          const first = groupClasses[0];
          const gradeLevel = (levelMap[first.niveau] || '07') as GradeLevel;
          const branch = (first.serie || null) as Branch | null;
          catalog.push({
            code: `CLS_${first.niveau}${first.serie ? `_${first.serie}` : ''}`,
            name: `${first.niveau}${first.serie ? ` ${first.serie}` : ''}`,
            gradeLevel,
            branch,
            coefficient: 0,
            weeklyHours: 0,
            classrooms: groupClasses.map(c => c.nom),
            studentCount: 0,
            teachers: [],
          });
        }

        setCatalogProgress(80);
        setCatalogLabel('Sauvegarde…');
        const newSettings = { ...settings, courseCatalog: catalog };
        updateSettings(newSettings);

        // Also update Firestore establishment if available
        if (currentEstablishment) {
          setCatalogProgress(90);
          await updateEstablishment(currentEstablishment.id, { courseCatalog: catalog });
        }

        setCatalogProgress(100);
        setCatalogLabel('Terminé');
        setCatalogResult(`Catalogue créé avec ${allClasses.length} classes depuis les données synchronisées.`);
      }
    } catch (err) {
      setCatalogProgress(100);
      setCatalogLabel('');
      setCatalogResult(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingCatalog(false);
    }
  }, [settings, updateSettings, currentEstablishment]);

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

      {/* Sync from SuperAdmin data */}
      {hasData && (
        <div className="card-cassie p-6">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4" style={{ color: '#5556fd' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#06072d' }}>Données synchronisées</h3>
          </div>
          <p className="text-xs mb-4" style={{ color: '#8392a5' }}>
            Mettez à jour les données de cette session à partir des données synchronisées dans Super Admin (matricules, sexe, classe, etc.)
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleEnrichStudents}
              disabled={enriching}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium border hover:bg-[#f0f0ff] transition-colors disabled:opacity-50"
              style={{ borderColor: '#e6e7ef', color: '#5556fd' }}
            >
              {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Mettre à jour les élèves
            </button>

            <button
              onClick={handleLoadCatalog}
              disabled={loadingCatalog}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium border hover:bg-[#e8f5e8] transition-colors disabled:opacity-50"
              style={{ borderColor: '#e6e7ef', color: '#22a356' }}
            >
              {loadingCatalog ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Charger le catalogue
            </button>
          </div>

          {enriching && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#5556fd' }}>
                <span>{enrichLabel}</span>
                <span>{enrichProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#e6e7ef' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${enrichProgress}%`, background: '#5556fd' }}
                />
              </div>
            </div>
          )}

          {enrichResult && (
            <div className="mt-3 p-2.5 rounded text-xs" style={{
              background: enrichResult.includes('Erreur') || enrichResult.includes('Aucun') ? '#fce8ea' : '#e8f5e8',
              color: enrichResult.includes('Erreur') || enrichResult.includes('Aucun') ? '#dc3545' : '#22a356',
            }}>
              {enrichResult}
            </div>
          )}

          {loadingCatalog && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#22a356' }}>
                <span>{catalogLabel}</span>
                <span>{catalogProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#e6e7ef' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${catalogProgress}%`, background: '#22a356' }}
                />
              </div>
            </div>
          )}

          {catalogResult && (
            <div className="mt-3 p-2.5 rounded text-xs" style={{
              background: catalogResult.includes('Erreur') || catalogResult.includes('Aucun') ? '#fce8ea' : '#e8f5e8',
              color: catalogResult.includes('Erreur') || catalogResult.includes('Aucun') ? '#dc3545' : '#22a356',
            }}>
              {catalogResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
