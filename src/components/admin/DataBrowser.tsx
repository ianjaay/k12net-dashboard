/**
 * DataBrowser — Browse synchronized data (classes, students, teachers)
 * for a given establishment. Shown in SuperAdmin detail view after sync.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Users, GraduationCap, ChevronRight, ChevronLeft, Search,
  Loader2, Trash2, Upload, Send,
} from 'lucide-react';
import {
  getClassesByEtablissement,
  getElevesByClasse,
  getElevesByEtablissement,
  getEnseignantsByEtablissement,
  clearEstablishmentData,
  saveEstablishmentToCloud,
  loadEstablishmentFromCloud,
} from '../../lib/educationDB';
import { updateEstablishment } from '../../lib/firestoreEstablishments';
import type { ClasseML, EleveML, Enseignant } from '../../types/multiLevel';
import type { CourseDefinition } from '../../types/k12';

type Tab = 'classes' | 'students' | 'teachers';

interface Props {
  /** The OneRoster sourcedId used as establishment ID in educationDB */
  establishmentId: string | null;
  establishmentName: string;
  /** Firestore establishment ID to update courseCatalog */
  firestoreEstablishmentId?: string;
  /** Existing course catalog to merge with */
  existingCatalog?: CourseDefinition[];
}

export default function DataBrowser({ establishmentId, firestoreEstablishmentId, existingCatalog }: Props) {
  const [tab, setTab] = useState<Tab>('classes');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Data
  const [classes, setClasses] = useState<ClasseML[]>([]);
  const [students, setStudents] = useState<EleveML[]>([]);
  const [teachers, setTeachers] = useState<Enseignant[]>([]);

  // Drill-down: selected class → show its students
  const [selectedClass, setSelectedClass] = useState<ClasseML | null>(null);
  const [classStudents, setClassStudents] = useState<EleveML[]>([]);
  const [loadingClassStudents, setLoadingClassStudents] = useState(false);

  // Counts
  const [totalClasses, setTotalClasses] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cloud save/load state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  const loadData = useCallback(async () => {
    if (!establishmentId) return;
    setLoading(true);
    try {
      let [cls, stu, tea] = await Promise.all([
        getClassesByEtablissement(establishmentId),
        getElevesByEtablissement(establishmentId),
        getEnseignantsByEtablissement(establishmentId),
      ]);

      // If local is empty, try loading from cloud
      if (cls.length === 0 && stu.length === 0 && tea.length === 0) {
        setCloudLoading(true);
        const cloud = await loadEstablishmentFromCloud(establishmentId);
        setCloudLoading(false);
        if (cloud && (cloud.classes > 0 || cloud.eleves > 0 || cloud.enseignants > 0)) {
          [cls, stu, tea] = await Promise.all([
            getClassesByEtablissement(establishmentId),
            getElevesByEtablissement(establishmentId),
            getEnseignantsByEtablissement(establishmentId),
          ]);
        }
      }

      setClasses(cls);
      setStudents(stu);
      setTeachers(tea);
      setTotalClasses(cls.length);
      setTotalStudents(stu.length);
      setTotalTeachers(tea.length);
    } catch (err) {
      console.error('DataBrowser load error:', err);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(async () => {
    if (!establishmentId) return;
    setDeleting(true);
    try {
      await clearEstablishmentData(establishmentId);
      setClasses([]);
      setStudents([]);
      setTeachers([]);
      setTotalClasses(0);
      setTotalStudents(0);
      setTotalTeachers(0);
      setSelectedClass(null);
      setClassStudents([]);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [establishmentId]);

  const handleSaveToCloud = useCallback(async () => {
    if (!establishmentId) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const counts = await saveEstablishmentToCloud(establishmentId);
      setSaveMessage(`Enregistré : ${counts.classes} classes, ${counts.eleves} élèves, ${counts.enseignants} enseignants`);
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err) {
      setSaveMessage(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [establishmentId]);

  /**
   * Push synced classes as course catalog entries to the Firestore establishment.
   * - If a catalog already exists, updates classrooms lists with synced class names.
   * - If no catalog exists, creates one entry per class.
   */
  const handlePushCatalog = useCallback(async () => {
    if (!firestoreEstablishmentId || classes.length === 0) return;
    setPushing(true);
    setSaveMessage(null);
    try {
      const classNames = classes.map(c => c.nom);

      if (existingCatalog && existingCatalog.length > 0) {
        // Merge: for each catalog entry, update classrooms to include synced classes
        // that match the same grade level / branch
        const updated = existingCatalog.map(course => {
          const matchingClasses = classes
            .filter(c => {
              // Match by grade level pattern in class name
              const courseClassrooms = course.classrooms || [];
              // Keep existing classrooms + add new ones from sync
              return courseClassrooms.some(cr => c.nom === cr) ||
                classNames.some(cn => cn === c.nom && course.classrooms.includes(cn));
            });
          return {
            ...course,
            classrooms: [...new Set([
              ...course.classrooms,
              ...matchingClasses.map(c => c.nom),
            ])],
          };
        });
        await updateEstablishment(firestoreEstablishmentId, {
          courseCatalog: updated,
        });
      } else {
        // No existing catalog: create one entry per unique level+serie combination
        // This gives the admin a starting structure to work with
        const byLevel = new Map<string, ClasseML[]>();
        for (const cls of classes) {
          const key = `${cls.niveau}${cls.serie ? `_${cls.serie}` : ''}`;
          if (!byLevel.has(key)) byLevel.set(key, []);
          byLevel.get(key)!.push(cls);
        }

        const catalog: CourseDefinition[] = [];
        for (const [, groupClasses] of byLevel) {
          const first = groupClasses[0];
          const levelMap: Record<string, string> = {
            'Sixième': '07', 'Cinquième': '08', 'Quatrième': '09', 'Troisième': '10',
            'Seconde': '11', 'Première': '12', 'Terminale': '13',
          };
          const gradeLevel = (levelMap[first.niveau] || '07') as import('../../types/k12').GradeLevel;
          const branch = (first.serie || null) as import('../../types/k12').Branch | null;
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

        await updateEstablishment(firestoreEstablishmentId, {
          courseCatalog: catalog,
        });
      }

      setSaveMessage(`${classNames.length} classes appliquées au catalogue de l'établissement`);
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err) {
      setSaveMessage(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPushing(false);
    }
  }, [firestoreEstablishmentId, classes, existingCatalog]);

  // Load students for a selected class
  const openClass = useCallback(async (cls: ClasseML) => {
    setSelectedClass(cls);
    setLoadingClassStudents(true);
    try {
      const stu = await getElevesByClasse(cls.id);
      setClassStudents(stu);
    } catch {
      setClassStudents([]);
    } finally {
      setLoadingClassStudents(false);
    }
  }, []);

  if (!establishmentId) {
    return null;
  }

  const hasData = totalClasses > 0 || totalStudents > 0 || totalTeachers > 0;

  if (loading) {
    return (
      <div className="card-cassie p-5 mt-4">
        <div className="flex items-center gap-2 justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#5556fd' }} />
          <span className="text-sm" style={{ color: '#8392a5' }}>
            {cloudLoading ? 'Chargement depuis le cloud…' : 'Chargement des données…'}
          </span>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="card-cassie p-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4" style={{ color: '#8392a5' }} />
          <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>Données synchronisées</h3>
        </div>
        <p className="text-sm" style={{ color: '#8392a5' }}>
          Aucune donnée synchronisée pour cet établissement. Lancez une synchronisation ci-dessus.
        </p>
      </div>
    );
  }

  // Filter logic
  const q = search.toLowerCase().trim();

  const filteredClasses = q
    ? classes.filter(c => c.nom.toLowerCase().includes(q) || c.niveau.toLowerCase().includes(q))
    : classes;

  const filteredStudents = q
    ? students.filter(s =>
        s.nom.toLowerCase().includes(q) ||
        s.prenom.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q) ||
        (s.salle_de_classe || '').toLowerCase().includes(q)
      )
    : students;

  const filteredTeachers = q
    ? teachers.filter(t =>
        t.nom.toLowerCase().includes(q) ||
        t.prenom.toLowerCase().includes(q) ||
        t.matricule.toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q)
      )
    : teachers;

  const filteredClassStudents = q
    ? classStudents.filter(s =>
        s.nom.toLowerCase().includes(q) ||
        s.prenom.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q)
      )
    : classStudents;

  // Class detail view
  if (selectedClass) {
    return (
      <div className="card-cassie p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => { setSelectedClass(null); setClassStudents([]); setSearch(''); }}
            className="p-1 rounded hover:bg-[#f0f0ff] transition-colors"
            style={{ color: '#5556fd' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <BookOpen className="w-4 h-4" style={{ color: '#5556fd' }} />
          <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>
            {selectedClass.nom}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#f0f0ff', color: '#5556fd' }}>
            {selectedClass.niveau}{selectedClass.serie ? ` — ${selectedClass.serie}` : ''}
          </span>
          <span className="text-xs ml-auto" style={{ color: '#8392a5' }}>
            {classStudents.length} élève{classStudents.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8392a5' }} />
          <input
            type="text"
            placeholder="Rechercher un élève…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border rounded pl-9 pr-3 py-2"
            style={{ borderColor: '#e6e7ef', color: '#373857' }}
          />
        </div>

        {loadingClassStudents ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#5556fd' }} />
          </div>
        ) : filteredClassStudents.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: '#8392a5' }}>
            {q ? 'Aucun résultat.' : 'Aucun élève dans cette classe.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#e6e7ef' }}>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Matricule</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Nom</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Prénom</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Sexe</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Date naissance</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Qualité</th>
                </tr>
              </thead>
              <tbody>
                {filteredClassStudents.map(s => (
                  <tr key={s.id} className="border-b hover:bg-[#f9f9fd]" style={{ borderColor: '#f3f6f9' }}>
                    <td className="py-2 px-2 font-mono text-xs" style={{ color: '#575d78' }}>{s.matricule}</td>
                    <td className="py-2 px-2 font-medium" style={{ color: '#06072d' }}>{s.nom}</td>
                    <td className="py-2 px-2" style={{ color: '#373857' }}>{s.prenom}</td>
                    <td className="py-2 px-2" style={{ color: '#575d78' }}>{s.sexe === 'Masculin' ? 'M' : 'F'}</td>
                    <td className="py-2 px-2" style={{ color: '#575d78' }}>{s.date_naissance || '—'}</td>
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{
                        background: s.qualite === 'Redoublant' ? '#fce8ea' : '#e8f5e8',
                        color: s.qualite === 'Redoublant' ? '#dc3545' : '#22a356',
                      }}>
                        {s.qualite || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Main browser view
  const tabs: { key: Tab; label: string; icon: typeof BookOpen; count: number }[] = [
    { key: 'classes', label: 'Classes', icon: BookOpen, count: totalClasses },
    { key: 'students', label: 'Élèves', icon: GraduationCap, count: totalStudents },
    { key: 'teachers', label: 'Enseignants', icon: Users, count: totalTeachers },
  ];

  return (
    <div className="card-cassie p-5 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4" style={{ color: '#5556fd' }} />
        <h3 className="font-medium text-sm" style={{ color: '#06072d' }}>
          Données synchronisées
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSaveToCloud}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border hover:bg-[#f0f0ff] transition-colors disabled:opacity-50"
            style={{ borderColor: '#e6e7ef', color: '#5556fd' }}
            title="Enregistrer dans le cloud"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
          {firestoreEstablishmentId && totalClasses > 0 && (
            <button
              onClick={handlePushCatalog}
              disabled={pushing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border hover:bg-[#e8f5e8] transition-colors disabled:opacity-50"
              style={{ borderColor: '#e6e7ef', color: '#22a356' }}
              title="Appliquer les classes comme catalogue de cours"
            >
              {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Appliquer au catalogue
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border hover:bg-[#fce8ea] transition-colors"
            style={{ borderColor: '#e6e7ef', color: '#dc3545' }}
            title="Supprimer les données synchronisées"
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </div>
      </div>

      {/* Save confirmation message */}
      {saveMessage && (
        <div className="mb-3 p-2.5 rounded text-xs" style={{
          background: saveMessage.startsWith('Erreur') ? '#fce8ea' : '#e8f5e8',
          color: saveMessage.startsWith('Erreur') ? '#dc3545' : '#22a356',
        }}>
          {saveMessage}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mb-4 p-4 rounded-lg border" style={{ background: '#fce8ea', borderColor: '#f5c6cb' }}>
          <p className="text-sm font-medium mb-1" style={{ color: '#dc3545' }}>
            Supprimer toutes les données synchronisées ?
          </p>
          <p className="text-xs mb-3" style={{ color: '#856404' }}>
            {totalClasses} classes, {totalStudents} élèves, {totalTeachers} enseignants seront supprimés. Cette action est irréversible.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: '#dc3545' }}
            >
              {deleting ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded text-xs font-medium border"
              style={{ borderColor: '#e6e7ef', color: '#575d78' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {tabs.map(t => (
          <div key={t.key}
            className="rounded-lg p-3 text-center cursor-pointer transition-all"
            style={{
              background: tab === t.key ? '#f0f0ff' : '#f9f9fd',
              border: `1px solid ${tab === t.key ? '#5556fd' : '#e6e7ef'}`,
            }}
            onClick={() => { setTab(t.key); setSearch(''); }}
          >
            <t.icon className="w-5 h-5 mx-auto mb-1" style={{ color: tab === t.key ? '#5556fd' : '#8392a5' }} />
            <p className="text-lg font-bold" style={{ color: '#06072d' }}>{t.count}</p>
            <p className="text-xs" style={{ color: '#8392a5' }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8392a5' }} />
        <input
          type="text"
          placeholder={
            tab === 'classes' ? 'Rechercher une classe…' :
            tab === 'students' ? 'Rechercher un élève…' :
            'Rechercher un enseignant…'
          }
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border rounded pl-9 pr-3 py-2"
          style={{ borderColor: '#e6e7ef', color: '#373857' }}
        />
      </div>

      {/* Classes tab */}
      {tab === 'classes' && (
        <div className="space-y-1">
          {filteredClasses.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#8392a5' }}>
              {q ? 'Aucun résultat.' : 'Aucune classe.'}
            </p>
          ) : (
            filteredClasses.map(c => {
              const studentCount = students.filter(s => s.classe_id === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => openClass(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-left hover:bg-[#f0f0ff] transition-colors"
                >
                  <div className="p-1.5 rounded" style={{ background: '#f0f0ff' }}>
                    <BookOpen className="w-4 h-4" style={{ color: '#5556fd' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: '#06072d' }}>{c.nom}</p>
                    <p className="text-xs" style={{ color: '#8392a5' }}>
                      {c.niveau}{c.serie ? ` — ${c.serie}` : ''} · {c.annee_scolaire}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#575d78' }}>
                      {studentCount} élève{studentCount > 1 ? 's' : ''}
                    </span>
                    <ChevronRight className="w-4 h-4" style={{ color: '#8392a5' }} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Students tab */}
      {tab === 'students' && (
        <div className="overflow-x-auto">
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#8392a5' }}>
              {q ? 'Aucun résultat.' : 'Aucun élève.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#e6e7ef' }}>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Matricule</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Nom</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Prénom</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Classe</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Sexe</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.slice(0, 200).map(s => (
                  <tr key={s.id} className="border-b hover:bg-[#f9f9fd]" style={{ borderColor: '#f3f6f9' }}>
                    <td className="py-2 px-2 font-mono text-xs" style={{ color: '#575d78' }}>{s.matricule}</td>
                    <td className="py-2 px-2 font-medium" style={{ color: '#06072d' }}>{s.nom}</td>
                    <td className="py-2 px-2" style={{ color: '#373857' }}>{s.prenom}</td>
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f0f0ff', color: '#5556fd' }}>
                        {s.salle_de_classe || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-2" style={{ color: '#575d78' }}>{s.sexe === 'Masculin' ? 'M' : 'F'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filteredStudents.length > 200 && (
            <p className="text-xs text-center py-2" style={{ color: '#8392a5' }}>
              Affichage des 200 premiers résultats sur {filteredStudents.length}
            </p>
          )}
        </div>
      )}

      {/* Teachers tab */}
      {tab === 'teachers' && (
        <div className="overflow-x-auto">
          {filteredTeachers.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#8392a5' }}>
              {q ? 'Aucun résultat.' : 'Aucun enseignant.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#e6e7ef' }}>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Matricule</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Nom</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Prénom</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Email</th>
                  <th className="text-left py-2 px-2 font-medium text-xs" style={{ color: '#8392a5' }}>Téléphone</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map(t => (
                  <tr key={t.id} className="border-b hover:bg-[#f9f9fd]" style={{ borderColor: '#f3f6f9' }}>
                    <td className="py-2 px-2 font-mono text-xs" style={{ color: '#575d78' }}>{t.matricule}</td>
                    <td className="py-2 px-2 font-medium" style={{ color: '#06072d' }}>{t.nom}</td>
                    <td className="py-2 px-2" style={{ color: '#373857' }}>{t.prenom}</td>
                    <td className="py-2 px-2 text-xs" style={{ color: '#575d78' }}>{t.email || '—'}</td>
                    <td className="py-2 px-2 text-xs" style={{ color: '#575d78' }}>{t.telephone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
