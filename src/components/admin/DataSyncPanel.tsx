/**
 * DataSyncPanel — Per-establishment data sync from OneRoster API.
 * Fetches classes, students, teachers, enrollments for a given school.
 * Shown inside the SuperAdmin establishment detail view.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, StopCircle, Loader2, Database, Users, BookOpen, GraduationCap, ClipboardList } from 'lucide-react';
import type { OneRosterApiConfig, OneRosterSession } from '../../types/oneRoster';
import { OneRosterService } from '../../lib/oneRosterService';
import { getApiConfig } from '../../lib/educationDB';
import {
  mapOrgToEtablissement,
  mapClassToClasseML,
  mapUserToEleve,
  mapUserToEnseignant,
  mapEnrollment,
  createSyncLog,
} from '../../lib/oneRosterService';
import {
  saveEtablissements,
  saveClasses,
  saveEleves,
  saveEnseignants,
  saveEnrollments,
  addSyncLog,
  seedDRENAs,
} from '../../lib/educationDB';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn' | 'fetch';
}

interface SyncStats {
  classes: number;
  students: number;
  teachers: number;
  enrollments: number;
}

interface Props {
  establishmentName: string;
  /** We'll try to match this name against OneRoster schools */
  establishmentCode?: string;
}

export default function DataSyncPanel({ establishmentName, establishmentCode }: Props) {
  const [apiConfig, setApiConfig] = useState<OneRosterApiConfig | null>(null);
  const [service, setService] = useState<OneRosterService | null>(null);
  const [loading, setLoading] = useState(true);

  // Academic year selection
  const [academicYears, setAcademicYears] = useState<OneRosterSession[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [loadingYears, setLoadingYears] = useState(false);

  // School matching
  const [matchedSchoolId, setMatchedSchoolId] = useState<string | null>(null);
  const [matchedSchoolName, setMatchedSchoolName] = useState<string | null>(null);
  const [schoolSearching, setSchoolSearching] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<Array<{ id: string; name: string }>>([]);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [stats, setStats] = useState<SyncStats>({ classes: 0, students: 0, teachers: 0, enrollments: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const cancelRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Load API config
  useEffect(() => {
    (async () => {
      const config = await getApiConfig();
      if (config) {
        setApiConfig(config);
        const svc = new OneRosterService(config);
        setService(svc);
      }
      setLoading(false);
    })();
  }, []);

  // Load schools and academic years when service is ready
  useEffect(() => {
    if (!service) return;
    (async () => {
      setSchoolSearching(true);
      setLoadingYears(true);
      try {
        const [schools, sessions] = await Promise.all([
          service.getSchools(),
          service.getAcademicSessions(),
        ]);

        // Schools
        const schoolList = schools.map(s => ({ id: s.sourcedId, name: s.name }));
        setAvailableSchools(schoolList);

        // Try to match by code or name
        const codeLower = (establishmentCode || '').toLowerCase().trim();
        const nameLower = establishmentName.toLowerCase().trim();
        const match = schools.find(s =>
          (codeLower && s.identifier?.toLowerCase() === codeLower)
          || s.name.toLowerCase() === nameLower
          || s.name.toLowerCase().includes(nameLower)
          || nameLower.includes(s.name.toLowerCase())
        );
        if (match) {
          setMatchedSchoolId(match.sourcedId);
          setMatchedSchoolName(match.name);
        } else if (schoolList.length > 0) {
          setMatchedSchoolId(schoolList[0].id);
          setMatchedSchoolName(schoolList[0].name);
        }

        // Academic years (type = 'schoolYear')
        const years = sessions.filter(s => s.type === 'schoolYear')
          .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear));
        setAcademicYears(years);
        if (years.length > 0) setSelectedYearId(years[0].sourcedId);
      } catch (err) {
        addLog(`Erreur de connexion API: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        setSchoolSearching(false);
        setLoadingYears(false);
      }
    })();
  }, [service]);

  const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { time: now(), message, type }]);
  }, []);

  const handleSync = useCallback(async () => {
    if (!service || !matchedSchoolId || !selectedYearId) return;
    cancelRef.current = false;
    setSyncing(true);
    setSyncDone(false);
    setStats({ classes: 0, students: 0, teachers: 0, enrollments: 0 });
    setLogs([]);
    setProgress(0);

    const startTime = Date.now();
    const syncLog = createSyncLog('api', 'full');
    const selectedYear = academicYears.find(y => y.sourcedId === selectedYearId);
    const yearLabel = selectedYear?.title ?? selectedYearId;

    try {
      addLog(`Démarrage de la synchronisation — ${establishmentName} (${yearLabel})`, 'info');
      await seedDRENAs();

      // 1. Get school details and save establishment
      setProgressLabel('Établissement…');
      setProgress(5);
      addLog('↓ Récupération de l\'établissement…', 'fetch');
      const schoolData = await service.getSchoolById(matchedSchoolId);
      const etabML = mapOrgToEtablissement(schoolData, schoolData.parent?.sourcedId ?? '');
      await saveEtablissements([etabML]);
      addLog(`✓ Établissement: ${schoolData.name}`, 'success');
      if (cancelRef.current) { addLog('⛔ Synchronisation interrompue', 'warn'); setSyncing(false); return; }

      // 2. Get classes
      setProgressLabel('Classes…');
      setProgress(15);
      addLog('↓ Récupération des classes…', 'fetch');
      const classes = await service.getClassesBySchool(matchedSchoolId);
      const classesML = classes.map(c => mapClassToClasseML(c, matchedSchoolId, yearLabel));
      if (classesML.length > 0) await saveClasses(classesML);
      setStats(s => ({ ...s, classes: classesML.length }));
      syncLog.entites_synchronisees.classes = classesML.length;
      addLog(`✓ ${classesML.length} classes`, 'success');
      if (cancelRef.current) { addLog('⛔ Synchronisation interrompue', 'warn'); setSyncing(false); return; }

      // 3. Get students
      setProgressLabel('Élèves…');
      setProgress(35);
      addLog('↓ Récupération des élèves…', 'fetch');
      const students = await service.getStudentsBySchool(matchedSchoolId);
      const elevesML = students.map(s => mapUserToEleve(s, '', '', matchedSchoolId, yearLabel));
      if (elevesML.length > 0) await saveEleves(elevesML);
      setStats(s => ({ ...s, students: elevesML.length }));
      syncLog.entites_synchronisees.students = elevesML.length;
      addLog(`✓ ${elevesML.length} élèves`, 'success');
      if (cancelRef.current) { addLog('⛔ Synchronisation interrompue', 'warn'); setSyncing(false); return; }

      // 4. Get teachers
      setProgressLabel('Enseignants…');
      setProgress(55);
      addLog('↓ Récupération des enseignants…', 'fetch');
      const teachers = await service.getTeachersBySchool(matchedSchoolId);
      const enseignantsML = teachers.map(t => mapUserToEnseignant(t, matchedSchoolId));
      if (enseignantsML.length > 0) await saveEnseignants(enseignantsML);
      setStats(s => ({ ...s, teachers: enseignantsML.length }));
      syncLog.entites_synchronisees.teachers = enseignantsML.length;
      addLog(`✓ ${enseignantsML.length} enseignants`, 'success');
      if (cancelRef.current) { addLog('⛔ Synchronisation interrompue', 'warn'); setSyncing(false); return; }

      // 5. Get enrollments
      setProgressLabel('Inscriptions…');
      setProgress(75);
      addLog('↓ Récupération des inscriptions…', 'fetch');
      const enrollments = await service.getEnrollmentsBySchool(matchedSchoolId);
      const enrollmentsML = enrollments.map(mapEnrollment);
      if (enrollmentsML.length > 0) await saveEnrollments(enrollmentsML);
      setStats(s => ({ ...s, enrollments: enrollmentsML.length }));
      syncLog.entites_synchronisees.enrollments = enrollmentsML.length;
      addLog(`✓ ${enrollmentsML.length} inscriptions`, 'success');

      // 6. Link students to classes via enrollments
      setProgressLabel('Liaison élèves ↔ classes…');
      setProgress(90);
      const classMap = new Map(classesML.map(c => [c.id, c]));
      const studentEnrollments = enrollments.filter(e => e.role === 'student');
      for (const enr of studentEnrollments) {
        const cls = classMap.get(enr.class.sourcedId);
        if (cls) {
          const eleve = elevesML.find(e => e.id === enr.user.sourcedId);
          if (eleve) {
            eleve.classe_id = cls.id;
            eleve.salle_de_classe = cls.nom;
            eleve.niveau_scolaire = cls.niveau;
            eleve.serie = cls.serie;
          }
        }
      }
      if (elevesML.length > 0) await saveEleves(elevesML);
      addLog('✓ Élèves liés aux classes', 'success');

      // Done
      setProgress(100);
      setProgressLabel('Terminé');
      syncLog.statut = 'succes';
      syncLog.duree_ms = Date.now() - startTime;
      await addSyncLog(syncLog);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      addLog(`🏁 Synchronisation terminée en ${duration}s`, 'success');
      setSyncDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`✗ Erreur: ${msg}`, 'error');
      syncLog.statut = 'erreur';
      syncLog.erreurs = [msg];
      syncLog.duree_ms = Date.now() - startTime;
      await addSyncLog(syncLog);
    } finally {
      setSyncing(false);
    }
  }, [service, matchedSchoolId, selectedYearId, academicYears, establishmentName, addLog]);

  const logColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '#22d273';
      case 'error': return '#ff4d4f';
      case 'warn': return '#faad14';
      case 'fetch': return '#5556fd';
      default: return '#8392a5';
    }
  };

  if (loading) return null;

  if (!apiConfig) {
    return (
      <div className="card-cassie p-5">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4" style={{ color: '#8392a5' }} />
          <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>Synchronisation des données</h3>
        </div>
        <p className="text-sm" style={{ color: '#8392a5' }}>
          Configurez d'abord l'API OneRoster dans la section ci-dessus pour pouvoir synchroniser les données.
        </p>
      </div>
    );
  }

  return (
    <div className="card-cassie p-5">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4" style={{ color: '#5556fd' }} />
        <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>
          Synchronisation des données
        </h3>
      </div>

      {/* School matching */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>
            Établissement API
          </label>
          {schoolSearching ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#5556fd' }} />
              <span className="text-xs" style={{ color: '#8392a5' }}>Recherche…</span>
            </div>
          ) : (
            <select
              value={matchedSchoolId ?? ''}
              onChange={e => {
                const id = e.target.value;
                setMatchedSchoolId(id);
                setMatchedSchoolName(availableSchools.find(s => s.id === id)?.name ?? null);
              }}
              className="w-full text-sm border rounded px-3 py-2"
              style={{ borderColor: '#e6e7ef', color: '#373857' }}
            >
              {availableSchools.length === 0 && <option value="">Aucun établissement trouvé</option>}
              {availableSchools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>
            Année scolaire
          </label>
          {loadingYears ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#5556fd' }} />
              <span className="text-xs" style={{ color: '#8392a5' }}>Chargement…</span>
            </div>
          ) : (
            <select
              value={selectedYearId}
              onChange={e => setSelectedYearId(e.target.value)}
              className="w-full text-sm border rounded px-3 py-2"
              style={{ borderColor: '#e6e7ef', color: '#373857' }}
            >
              {academicYears.length === 0 && <option value="">Aucune année trouvée</option>}
              {academicYears.map(y => (
                <option key={y.sourcedId} value={y.sourcedId}>{y.title}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Sync button */}
      <div className="flex items-center gap-3 mb-4">
        {!syncing ? (
          <button
            onClick={handleSync}
            disabled={!matchedSchoolId || !selectedYearId || syncing}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#22d273' }}
          >
            <Play className="w-4 h-4" /> Synchroniser les données
          </button>
        ) : (
          <button
            onClick={() => { cancelRef.current = true; }}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white"
            style={{ background: '#ff4d4f' }}
          >
            <StopCircle className="w-4 h-4" /> Arrêter
          </button>
        )}
        {matchedSchoolName && !syncing && !syncDone && (
          <span className="text-xs" style={{ color: '#8392a5' }}>
            → {matchedSchoolName}
          </span>
        )}
      </div>

      {/* Progress & stats */}
      {(syncing || syncDone) && (
        <>
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: '#8392a5' }}>
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: '#f3f6f9' }}>
              <div className="h-2 rounded-full transition-all" style={{
                background: syncDone ? '#22d273' : '#5556fd',
                width: `${progress}%`,
              }} />
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Classes', value: stats.classes, icon: <BookOpen className="w-3.5 h-3.5" /> },
              { label: 'Élèves', value: stats.students, icon: <GraduationCap className="w-3.5 h-3.5" /> },
              { label: 'Enseignants', value: stats.teachers, icon: <Users className="w-3.5 h-3.5" /> },
              { label: 'Inscriptions', value: stats.enrollments, icon: <ClipboardList className="w-3.5 h-3.5" /> },
            ].map(s => (
              <div key={s.label} className="p-2 rounded text-center" style={{ background: '#f8f9fa' }}>
                <div className="text-lg font-bold" style={{ color: '#06072d' }}>{s.value}</div>
                <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: '#8392a5' }}>
                  {s.icon} {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Logs */}
          <div className="rounded border max-h-48 overflow-y-auto font-mono text-[11px] p-3" style={{ borderColor: '#e6e7ef', background: '#fafbfc' }}>
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span style={{ color: '#c0ccda' }}>{log.time}</span>
                <span style={{ color: logColor(log.type) }}>{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </>
      )}
    </div>
  );
}
