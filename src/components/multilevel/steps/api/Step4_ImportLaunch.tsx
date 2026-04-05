/**
 * Step4_ImportLaunch — Summary + real-time progress + stop with keep/discard dialog.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, Loader2, XCircle, StopCircle, Save, Trash2 } from 'lucide-react';
import type { OneRosterApiConfig, OrgSelectionTree, ImportProgress } from '../../../../types/oneRoster';
import type { OneRosterService } from '../../../../lib/oneRosterService';
import type { SelectedYear } from './Step3_SessionSelection';
import {
  mapOrgToEtablissement,
  mapClassToClasseML,
  mapUserToEleve,
  mapUserToEnseignant,
  mapEnrollment,
  createSyncLog,
} from '../../../../lib/oneRosterService';
import {
  db,
  saveEtablissements,
  saveClasses,
  saveEleves,
  saveEnseignants,
  saveEnrollments,
  addSyncLog,
  seedDRENAs,
} from '../../../../lib/educationDB';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn' | 'fetch';
}

interface Props {
  service: OneRosterService;
  orgTree: OrgSelectionTree;
  selectedYears: SelectedYear[];
  apiConfig: OneRosterApiConfig;
  onDone: () => void;
  onBack: () => void;
}

export default function Step4_ImportLaunch({
  service, orgTree, selectedYears, apiConfig, onDone, onBack,
}: Props) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const cancelRef = useRef(false);
  const ingestedIdsRef = useRef<{
    etablissements: string[];
    classes: string[];
    eleves: string[];
    enseignants: string[];
    enrollments: string[];
  }>({ etablissements: [], classes: [], eleves: [], enseignants: [], enrollments: [] });
  const logEndRef = useRef<HTMLDivElement>(null);
  const importDoneRef = useRef(false);

  const selectedSchools = orgTree.etablissements.filter(e => e.selected);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { time: now(), message, type }]);
  }, []);

  const handleStop = useCallback(() => {
    cancelRef.current = true;
    setShowStopDialog(true);
  }, []);

  const handleKeepData = useCallback(async () => {
    setShowStopDialog(false);
    addLog('Import arrêté — données déjà importées conservées.', 'warn');

    // Save partial sync log
    const syncLog = createSyncLog('api', 'full');
    syncLog.statut = 'partiel';
    syncLog.entites_synchronisees.schools = ingestedIdsRef.current.etablissements.length;
    syncLog.entites_synchronisees.classes = ingestedIdsRef.current.classes.length;
    syncLog.entites_synchronisees.students = ingestedIdsRef.current.eleves.length;
    syncLog.entites_synchronisees.teachers = ingestedIdsRef.current.enseignants.length;
    syncLog.entites_synchronisees.enrollments = ingestedIdsRef.current.enrollments.length;
    await addSyncLog(syncLog);

    setProgress(prev => prev ? { ...prev, statut: 'annule' } : prev);
    importDoneRef.current = true;
  }, [addLog]);

  const handleDiscardData = useCallback(async () => {
    setShowStopDialog(false);
    addLog('Suppression des données importées...', 'warn');

    try {
      const ids = ingestedIdsRef.current;
      await Promise.all([
        ids.etablissements.length > 0 && db.etablissements.bulkDelete(ids.etablissements),
        ids.classes.length > 0 && db.classes.bulkDelete(ids.classes),
        ids.eleves.length > 0 && db.eleves.bulkDelete(ids.eleves),
        ids.enseignants.length > 0 && db.enseignants.bulkDelete(ids.enseignants),
        ids.enrollments.length > 0 && db.enrollments.bulkDelete(ids.enrollments),
      ]);
      addLog(`Données supprimées : ${ids.etablissements.length} établissements, ${ids.classes.length} classes, ${ids.eleves.length} élèves`, 'success');
    } catch (err) {
      addLog(`Erreur lors de la suppression : ${err instanceof Error ? err.message : String(err)}`, 'error');
    }

    setProgress(prev => prev ? { ...prev, statut: 'annule', classes_importees: 0, eleves_importes: 0, enseignants_importes: 0, inscriptions_importees: 0 } : prev);
    importDoneRef.current = true;
  }, [addLog]);

  const handleLaunch = useCallback(async () => {
    cancelRef.current = false;
    importDoneRef.current = false;
    ingestedIdsRef.current = { etablissements: [], classes: [], eleves: [], enseignants: [], enrollments: [] };
    const startTime = Date.now();
    const syncLog = createSyncLog('api', 'full');

    const totalWork = selectedYears.length * selectedSchools.length;
    const initProgress: ImportProgress = {
      total_etablissements: totalWork,
      etablissements_termines: 0,
      etablissement_en_cours: '',
      classes_importees: 0,
      eleves_importes: 0,
      eleves_total_estime: 0,
      enseignants_importes: 0,
      inscriptions_importees: 0,
      pourcentage: 0,
      statut: 'en_cours',
      erreurs: [],
    };
    setProgress(initProgress);
    setLogs([]);
    addLog(`Démarrage de l'import — ${selectedYears.length} année(s) × ${selectedSchools.length} établissement(s)`, 'info');

    try {
      await seedDRENAs();
      addLog('Base initialisée', 'success');

      let workIdx = 0;
      for (const year of selectedYears) {
        addLog(`\n══════ Année scolaire : ${year.title} ══════`, 'info');

        for (const { org: etab } of selectedSchools) {
          if (cancelRef.current) {
            addLog(`⛔ Import interrompu après ${workIdx} / ${totalWork}`, 'warn');
            return;
          }

          const etabML = mapOrgToEtablissement(etab, etab.parent?.sourcedId ?? '');
          initProgress.etablissement_en_cours = `${year.title} — ${etab.name}`;
          setProgress({ ...initProgress });

          addLog(`━━━ ${etab.name} (${year.title}) ━━━`, 'info');

          try {
            // Save establishment
            await saveEtablissements([etabML]);
            if (!ingestedIdsRef.current.etablissements.includes(etabML.id)) {
              ingestedIdsRef.current.etablissements.push(etabML.id);
            }
            syncLog.entites_synchronisees.schools++;

            // Get classes
            addLog(`  ↓ Récupération des classes...`, 'fetch');
            const classes = await service.getClassesBySchool(etab.sourcedId);
            if (cancelRef.current) { addLog(`⛔ Import interrompu`, 'warn'); return; }
            const classesML = classes.map(c => mapClassToClasseML(c, etab.sourcedId, year.id));
            if (classesML.length > 0) {
              await saveClasses(classesML);
              ingestedIdsRef.current.classes.push(...classesML.map(c => c.id));
            }
            initProgress.classes_importees += classesML.length;
            syncLog.entites_synchronisees.classes += classesML.length;
            addLog(`  ✓ ${classesML.length} classes`, 'success');

            // Get students
            addLog(`  ↓ Récupération des élèves...`, 'fetch');
            const students = await service.getStudentsBySchool(etab.sourcedId);
            if (cancelRef.current) { addLog(`⛔ Import interrompu`, 'warn'); return; }
            const elevesML = students.map(s => mapUserToEleve(s, '', '', etab.sourcedId, year.id));
            if (elevesML.length > 0) {
              await saveEleves(elevesML);
              ingestedIdsRef.current.eleves.push(...elevesML.map(e => e.id));
            }
            initProgress.eleves_importes += elevesML.length;
            syncLog.entites_synchronisees.students += elevesML.length;
            addLog(`  ✓ ${elevesML.length} élèves`, 'success');

            // Get teachers
            addLog(`  ↓ Récupération des enseignants...`, 'fetch');
            const teachers = await service.getTeachersBySchool(etab.sourcedId);
            if (cancelRef.current) { addLog(`⛔ Import interrompu`, 'warn'); return; }
            const enseignantsML = teachers.map(t => mapUserToEnseignant(t, etab.sourcedId));
            if (enseignantsML.length > 0) {
              await saveEnseignants(enseignantsML);
              ingestedIdsRef.current.enseignants.push(...enseignantsML.map(e => e.id));
            }
            initProgress.enseignants_importes += enseignantsML.length;
            syncLog.entites_synchronisees.teachers += enseignantsML.length;
            addLog(`  ✓ ${enseignantsML.length} enseignants`, 'success');

            // Get enrollments
            addLog(`  ↓ Récupération des inscriptions...`, 'fetch');
            const enrollments = await service.getEnrollmentsBySchool(etab.sourcedId);
            if (cancelRef.current) { addLog(`⛔ Import interrompu`, 'warn'); return; }
            const enrollmentsML = enrollments.map(mapEnrollment);
            if (enrollmentsML.length > 0) {
              await saveEnrollments(enrollmentsML);
              ingestedIdsRef.current.enrollments.push(...enrollmentsML.map(e => e.id));
            }
            initProgress.inscriptions_importees += enrollmentsML.length;
            syncLog.entites_synchronisees.enrollments += enrollmentsML.length;
            addLog(`  ✓ ${enrollmentsML.length} inscriptions`, 'success');

            // Link students to classes via enrollments
            const classMap = new Map(classesML.map(c => [c.id, c]));
            const studentEnrollments = enrollments.filter(e => e.role === 'student');
            for (const enr of studentEnrollments) {
              const cls = classMap.get(enr.class.sourcedId);
              if (cls) {
                const existingEleve = elevesML.find(e => e.id === enr.user.sourcedId);
                if (existingEleve) {
                  existingEleve.classe_id = cls.id;
                  existingEleve.salle_de_classe = cls.nom;
                  existingEleve.niveau_scolaire = cls.niveau;
                  existingEleve.serie = cls.serie;
                }
              }
            }
            if (elevesML.length > 0) await saveEleves(elevesML);

            etabML.nb_enseignants = enseignantsML.length;
            await saveEtablissements([etabML]);

          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            initProgress.erreurs.push(`${etab.name} (${year.title}): ${msg}`);
            syncLog.erreurs = syncLog.erreurs ?? [];
            syncLog.erreurs.push(`${etab.name} (${year.title}): ${msg}`);
            addLog(`  ✗ Erreur : ${msg}`, 'error');
          }

          workIdx++;
          initProgress.etablissements_termines = workIdx;
          initProgress.pourcentage = Math.round((workIdx / totalWork) * 100);
          setProgress({ ...initProgress });
        }
      }

      initProgress.statut = initProgress.erreurs.length > 0 ? 'erreur' : 'termine';
      initProgress.pourcentage = 100;
      setProgress({ ...initProgress });

      syncLog.statut = initProgress.erreurs.length > 0 ? 'partiel' : 'succes';
      syncLog.duree_ms = Date.now() - startTime;
      await addSyncLog(syncLog);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      addLog(`🏁 Import terminé en ${duration}s — ${initProgress.eleves_importes} élèves, ${initProgress.classes_importees} classes`, 'success');
      importDoneRef.current = true;
    } catch (err) {
      initProgress.statut = 'erreur';
      initProgress.erreurs.push(err instanceof Error ? err.message : String(err));
      setProgress({ ...initProgress });
      addLog(`Erreur critique : ${err instanceof Error ? err.message : String(err)}`, 'error');
      importDoneRef.current = true;
    }
  }, [service, orgTree, selectedYears, selectedSchools, addLog]);

  const logColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '#22d273';
      case 'error': return '#ff4d4f';
      case 'warn': return '#faad14';
      case 'fetch': return '#5556fd';
      default: return '#8392a5';
    }
  };

  return (
    <div className="card-cassie p-6 space-y-4">
      <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
        {progress ? (progress.statut === 'en_cours' ? 'Import en cours' : 'Résultat') : 'Récapitulatif'}
      </h3>

      {/* ── Summary before launch ── */}
      {!progress && (
        <>
          <div className="text-sm space-y-1" style={{ color: '#06072d' }}>
            <p>• <strong>{selectedSchools.length}</strong> établissements sélectionnés</p>
            <p>• Années scolaires : {selectedYears.map(y => <strong key={y.id}>{y.title}</strong>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}</p>
            <p>• Données à importer : classes, élèves, enseignants, inscriptions</p>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg" style={{ color: '#8392a5' }}>
              ← Retour
            </button>
            <button
              onClick={handleLaunch}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: '#22d273' }}
            >
              <Play className="w-4 h-4" /> Démarrer l'import
            </button>
          </div>
        </>
      )}

      {/* ── Progress view ── */}
      {progress && (
        <>
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1" style={{ color: '#8392a5' }}>
              <span>{progress.etablissement_en_cours || 'Démarrage...'}</span>
              <span>{progress.etablissements_termines} / {progress.total_etablissements} — {progress.pourcentage}%</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: '#f3f6f9' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  background: progress.statut === 'erreur' ? '#ff4d4f'
                    : progress.statut === 'annule' ? '#faad14'
                    : '#5556fd',
                  width: `${progress.pourcentage}%`,
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Classes', value: progress.classes_importees },
              { label: 'Élèves', value: progress.eleves_importes },
              { label: 'Enseignants', value: progress.enseignants_importes },
              { label: 'Inscriptions', value: progress.inscriptions_importees },
            ].map(s => (
              <div key={s.label} className="p-2 rounded-lg" style={{ background: '#f8f9fa' }}>
                <div className="text-lg font-bold" style={{ color: '#06072d' }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: '#8392a5' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Real-time log console */}
          <div
            className="h-56 overflow-y-auto text-xs font-mono p-3 rounded-lg border"
            style={{ background: '#0d1117', borderColor: '#30363d' }}
          >
            {logs.map((entry, i) => (
              <div key={i} className="flex gap-2 leading-5">
                <span style={{ color: '#484f58' }}>{entry.time}</span>
                <span style={{ color: logColor(entry.type) }}>{entry.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            {progress.statut === 'en_cours' && !showStopDialog ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border"
                style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
              >
                <StopCircle className="w-4 h-4" /> Arrêter l'import
              </button>
            ) : (
              <div />
            )}
            {importDoneRef.current && (progress.statut === 'termine' || progress.statut === 'erreur' || progress.statut === 'annule') && (
              <button
                onClick={onDone}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: '#5556fd' }}
              >
                Terminer
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Stop confirmation dialog ── */}
      {showStopDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h4 className="font-bold text-sm" style={{ color: '#06072d' }}>
              Import interrompu
            </h4>
            <p className="text-sm" style={{ color: '#8392a5' }}>
              <strong>{ingestedIdsRef.current.etablissements.length}</strong> établissements,{' '}
              <strong>{ingestedIdsRef.current.classes.length}</strong> classes et{' '}
              <strong>{ingestedIdsRef.current.eleves.length}</strong> élèves ont déjà été importés.
            </p>
            <p className="text-sm" style={{ color: '#06072d' }}>
              Voulez-vous conserver ces données ou tout supprimer ?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDiscardData}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg border"
                style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
              >
                <Trash2 className="w-4 h-4" /> Tout supprimer
              </button>
              <button
                onClick={handleKeepData}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg text-white font-medium"
                style={{ background: '#22d273' }}
              >
                <Save className="w-4 h-4" /> Conserver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
