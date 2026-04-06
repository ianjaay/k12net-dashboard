import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Image, X, Save, Check, Building2, FileSpreadsheet, CheckCircle,
  Scale, Loader2, Users as UsersIcon, UserPlus, ShieldCheck as ShieldCheckIcon,
  ChevronDown, ChevronUp, Trash2, GraduationCap, Calculator,
} from 'lucide-react';
import JSZip from 'jszip';
import type { GlobalAppSettings } from '../contexts/GlobalSettingsContext';
import { useStudentPhotos } from '../contexts/StudentPhotosContext';
import { useAuth } from '../contexts/AuthContext';
import { extractMatriculeFromFilename } from '../utils/photos';
import { getAllUsers, updateUserStatus, updateUserAppRole, createPendingUser, deleteUserAccount } from '../lib/firestore';
import { parseSectionList, buildSubjectsByClass, extractGradeLevels, extractBranches } from '../utils/sectionListParser';
import { BUILTIN_RULES, getRulesForYear } from '../utils/k12RulesEngine';
import type { AcademicYear, K12YearRulesConfig } from '../types/k12';
import { GRADE_LEVEL_LABELS } from '../types/k12';
import type { UserProfile, AppRole, UserStatus } from '../types';
import { RefreshCw as RefreshIcon } from 'lucide-react';

interface Props {
  settings: GlobalAppSettings;
  onSettingsChange: (settings: GlobalAppSettings) => void;
}

type AdminSectionKey = 'logo' | 'courses' | 'school' | 'rules' | 'photos' | 'users';

export default function GlobalAdmin({ settings, onSettingsChange }: Props) {
  const { user: currentUser } = useAuth();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo || null);
  const [schoolName, setSchoolName] = useState(settings.schoolName || 'LYCÉE SAINTE MARIE DE COCODY ABIDJAN');
  const [academicYear, setAcademicYear] = useState<AcademicYear>(settings.academicYear || '2024');
  const [photoBaseUrl, setPhotoBaseUrl] = useState(settings.photoBaseUrl || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Course catalog
  const [coursesParsing, setCoursesParsing] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [localCatalog, setLocalCatalog] = useState(settings.courseCatalog);

  // Rules
  const [rulesConfig, setRulesConfig] = useState<K12YearRulesConfig>(
    settings.rulesConfig ?? getRulesForYear(settings.academicYear || '2024')
  );

  // Photos
  const { photos, setPhotos, photoCount } = useStudentPhotos();
  const [zipLoading, setZipLoading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, string> | null>(null);
  const [zipResult, setZipResult] = useState<{ added: number; errors: string[] } | null>(null);

  // Users management
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [userActionError, setUserActionError] = useState('');
  const [openSections, setOpenSections] = useState<Record<AdminSectionKey, boolean>>({
    logo: false,
    courses: true,
    school: true,
    rules: true,
    photos: false,
    users: true,
  });

  const toggleSection = useCallback((section: AdminSectionKey) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // ─── Course Catalog Stats ────────────────────────────────────────
  const catalogStats = useMemo(() => {
    if (!localCatalog || localCatalog.length === 0) return null;
    const levels = extractGradeLevels(localCatalog);
    const allClassrooms = new Set<string>();
    for (const c of localCatalog) {
      for (const cl of c.classrooms) allClassrooms.add(cl);
    }
    const subjectsByClass = buildSubjectsByClass(localCatalog);
    return {
      courseCount: localCatalog.length,
      levels,
      classroomCount: allClassrooms.size,
      subjectsByClass,
    };
  }, [localCatalog]);

  // ─── Users ───────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const list = await getAllUsers();
      setUsers(list);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleStatusChange = async (uid: string, status: UserStatus) => {
    await updateUserStatus(uid, status);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, status } : u));
  };

  const handleRoleChange = async (uid: string, role: AppRole) => {
    await updateUserAppRole(uid, role);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteError('');
    setInviteSuccess('');
    setInviteLoading(true);
    try {
      await createPendingUser(inviteEmail.trim(), inviteName.trim() || inviteEmail.trim());
      setInviteSuccess(`Invitation créée pour ${inviteEmail.trim()}`);
      setInviteEmail('');
      setInviteName('');
      await loadUsers();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser?.uid) {
      setUserActionError('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    const confirmed = confirm(`Supprimer le compte de ${targetUser.displayName || targetUser.email} ?`);
    if (!confirmed) return;
    setUserActionError('');
    try {
      await deleteUserAccount(targetUser.uid);
      setUsers(prev => prev.filter(user => user.uid !== targetUser.uid));
    } catch (err: unknown) {
      setUserActionError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  // ─── Logo ────────────────────────────────────────────────────────
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Veuillez sélectionner une image.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Taille max: 2 MB.'); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => { setLogoPreview(ev.target?.result as string); setHasUnsavedChanges(true); };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = () => { setLogoFile(null); setLogoPreview(null); setHasUnsavedChanges(true); };

  // ─── ZIP Photos ──────────────────────────────────────────────────
  const handleZipUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    const file = 'dataTransfer' in e ? e.dataTransfer.files[0] : (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
    if (!file) return;
    setZipLoading(true);
    setPendingPhotos(null);
    setZipResult(null);
    const errors: string[] = [];
    let added = 0;
    try {
      const zip = await JSZip.loadAsync(file);
      const newPhotos: Record<string, string> = { ...photos };
      const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp)$/i;
      const entries = Object.entries(zip.files).filter(
        ([name, entry]) => !entry.dir && IMAGE_EXTS.test(name) && !name.startsWith('__MACOSX'),
      );
      await Promise.all(entries.map(async ([name, entry]) => {
        const basename = name.split('/').pop() ?? name;
        const matricule = extractMatriculeFromFilename(basename);
        if (!matricule) { errors.push(`ID non trouvé: ${basename}`); return; }
        try {
          const blob = await entry.async('blob');
          const ext = basename.match(/\.[^.]+$/)?.[0] ?? '.jpg';
          const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(new Blob([blob], { type: mimeType }));
          });
          newPhotos[matricule] = dataUrl;
          added++;
        } catch { errors.push(`Erreur: ${basename}`); }
      }));
      setPendingPhotos(newPhotos);
      setZipResult({ added, errors });
    } catch (err) {
      setZipResult({ added: 0, errors: [`Impossible de lire le ZIP: ${String(err)}`] });
    } finally {
      setZipLoading(false);
    }
  }, [photos]);

  const handleConfirmPhotoImport = useCallback(() => {
    if (!pendingPhotos) return;
    setPhotos(pendingPhotos);
    setPendingPhotos(null);
  }, [pendingPhotos, setPhotos]);

  // ─── Section List Upload ─────────────────────────────────────────
  const handleSectionListUpload = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = 'dataTransfer' in e ? e.dataTransfer.files[0] : e.target.files?.[0];
    if (!file) return;
    setCoursesParsing(true);
    setCoursesError(null);
    try {
      const buf = await file.arrayBuffer();
      const catalog = parseSectionList(buf);
      setLocalCatalog(catalog);
      setHasUnsavedChanges(true);
    } catch (err) {
      setCoursesError(String(err));
    } finally {
      setCoursesParsing(false);
    }
  }, []);

  // ─── Rules Editing ───────────────────────────────────────────────
  const handleYearChange = (year: AcademicYear) => {
    setAcademicYear(year);
    const config = getRulesForYear(year, settings.yearConfigs);
    setRulesConfig(config);
    setHasUnsavedChanges(true);
  };

  const updateDistinctionThreshold = (
    group: '7-10' | '11-13',
    field: 'thMin' | 'theMin' | 'thfMin',
    value: number
  ) => {
    setRulesConfig(prev => ({
      ...prev,
      termDistinction: {
        ...prev.termDistinction,
        [group]: { ...prev.termDistinction[group], [field]: value },
      },
    }));
    setHasUnsavedChanges(true);
  };

  const updateSanctionThreshold = (field: keyof K12YearRulesConfig['termSanction'], value: number) => {
    setRulesConfig(prev => ({
      ...prev,
      termSanction: { ...prev.termSanction, [field]: value },
    }));
    setHasUnsavedChanges(true);
  };

  const updatePromotionThreshold = (field: keyof K12YearRulesConfig['promotion'], value: number) => {
    setRulesConfig(prev => ({
      ...prev,
      promotion: { ...prev.promotion, [field]: value },
    }));
    setHasUnsavedChanges(true);
  };

  // ─── Save ────────────────────────────────────────────────────────
  const handleSave = () => {
    setSaveStatus('saving');
    const newSettings: GlobalAppSettings = {
      ...settings,
      logo: logoPreview || undefined,
      schoolName: schoolName || undefined,
      academicYear,
      courseCatalog: localCatalog,
      rulesConfig,
      photoBaseUrl: photoBaseUrl.trim() || undefined,
      yearConfigs: {
        ...(settings.yearConfigs ?? {}),
        [academicYear]: rulesConfig,
      },
    };
    onSettingsChange(newSettings);
    setTimeout(() => {
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#06072d' }}>Administration K12net</h1>
          <p className="text-sm mt-1" style={{ color: '#8392a5' }}>
            Configuration des cours, règles de calcul et gestion des utilisateurs
          </p>
        </div>
        {hasUnsavedChanges && (
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded transition-colors disabled:opacity-50"
            style={{ background: '#5556fd' }}
          >
            {saveStatus === 'saving' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
            ) : saveStatus === 'saved' ? (
              <><Check className="w-4 h-4" /> Enregistré</>
            ) : (
              <><Save className="w-4 h-4" /> Enregistrer</>
            )}
          </button>
        )}
      </div>

      {/* ═══ School Info ═══ */}
      <AdminSection
        icon={<Building2 className="w-5 h-5" style={{ color: '#5556fd' }} />}
        title="Établissement & Année scolaire"
        open={openSections.school}
        onToggle={() => toggleSection('school')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Nom de l'établissement</label>
            <input
              type="text"
              value={schoolName}
              onChange={e => { setSchoolName(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
              style={{ borderColor: '#e6e7ef', color: '#373857' }}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Année scolaire</label>
              <select
                value={academicYear}
                onChange={e => handleYearChange(e.target.value)}
                className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
                style={{ borderColor: '#e6e7ef', color: '#373857' }}
              >
                <option value="2025">2025–2026</option>
                <option value="2024">2024–2025</option>
                <option value="2023">2023–2024</option>
                <option value="2022">2022–2023</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Règles actives</label>
              <div className="text-sm px-3 py-2 border rounded" style={{ borderColor: '#e6e7ef', background: '#f9f9fd', color: '#575d78' }}>
                <span className="font-medium">{academicYear}–{parseInt(academicYear) + 1}</span>
                {BUILTIN_RULES[academicYear] ? (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: '#e6f9ef', color: '#1a8a4d' }}>prédéfinies</span>
                ) : (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: '#fff3cd', color: '#856404' }}>personnalisées</span>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>URL du service photos élèves</label>
            <input
              type="url"
              value={photoBaseUrl}
              onChange={e => { setPhotoBaseUrl(e.target.value); setHasUnsavedChanges(true); }}
              placeholder="https://agfne.sigfne.net/vas/picture-noprod/"
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
              style={{ borderColor: '#e6e7ef', color: '#373857' }}
            />
            <p className="text-[11px] mt-1" style={{ color: '#8392a5' }}>
              Le matricule sera ajouté à la fin de l'URL. Ex : https://…/picture-noprod/<strong>20078204K</strong>
            </p>
          </div>
        </div>
      </AdminSection>

      {/* ═══ Course Catalog (Section List) ═══ */}
      <AdminSection
        icon={<FileSpreadsheet className="w-5 h-5" style={{ color: '#5556fd' }} />}
        title="Catalogue des cours (Section List)"
        open={openSections.courses}
        onToggle={() => toggleSection('courses')}
      >
        <div className="space-y-4">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Importez le fichier "Rapport sur la Liste des Sections" exporté depuis K12net.
            Ce fichier définit les matières, coefficients et classes.
          </p>

          {/* Current catalog status */}
          {catalogStats && (
            <div className="p-4 rounded border" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
                <span className="font-medium text-sm" style={{ color: '#166534' }}>
                  Catalogue chargé — {catalogStats.courseCount} cours · {catalogStats.classroomCount} classes
                </span>
              </div>

              {/* Level summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {catalogStats.levels.map(level => {
                  const branches = localCatalog ? extractBranches(localCatalog, level) : [];
                  const classCount = Object.keys(catalogStats.subjectsByClass).filter(cn => {
                    const subjects = catalogStats.subjectsByClass[cn];
                    return subjects.some(s => s.gradeLevel === level);
                  }).length;
                  return (
                    <div key={level} className="text-xs p-2 rounded" style={{ background: '#fff', border: '1px solid #e6e7ef' }}>
                      <div className="font-medium" style={{ color: '#06072d' }}>
                        {GRADE_LEVEL_LABELS[level]}
                        {branches.length > 0 && <span className="text-[10px] ml-1" style={{ color: '#8392a5' }}>({branches.join(', ')})</span>}
                      </div>
                      <div style={{ color: '#8392a5' }}>{classCount} classe(s)</div>
                    </div>
                  );
                })}
              </div>

              {/* Subjects per class */}
              <details className="mt-3">
                <summary className="text-xs font-medium cursor-pointer" style={{ color: '#5556fd' }}>
                  Voir les matières par classe
                </summary>
                <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                  {Object.entries(catalogStats.subjectsByClass).sort(([a], [b]) => a.localeCompare(b)).map(([className, subjects]) => (
                    <div key={className} className="text-xs p-2 rounded" style={{ background: '#f9f9fd', border: '1px solid #e6e7ef' }}>
                      <div className="font-medium mb-1" style={{ color: '#06072d' }}>{className}</div>
                      <div className="flex flex-wrap gap-1">
                        {subjects.map(s => (
                          <span
                            key={s.code}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                            style={{ background: s.isBehavioral ? '#fef3c7' : '#f0f0ff', color: s.isBehavioral ? '#92400e' : '#575d78' }}
                          >
                            {s.name}
                            <span className="font-medium" style={{ color: '#5556fd' }}>×{s.coefficient}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {coursesError && (
            <div className="p-3 rounded border text-sm" style={{ background: '#fce8ea', borderColor: '#dc3545', color: '#dc3545' }}>
              {coursesError}
            </div>
          )}

          {/* Upload zone */}
          <label
            className="block border-2 border-dashed rounded p-5 cursor-pointer transition-all hover:border-[#5556fd] hover:bg-[#f0f0ff]"
            style={{ borderColor: coursesParsing ? '#5556fd' : '#e6e7ef', background: coursesParsing ? '#f0f0ff' : 'white' }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleSectionListUpload}
          >
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleSectionListUpload} />
            <div className="flex items-center gap-4">
              {coursesParsing ? (
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5556fd' }} />
              ) : (
                <FileSpreadsheet className="w-6 h-6" style={{ color: '#c0ccda' }} />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm" style={{ color: '#06072d' }}>
                  {localCatalog ? 'Remplacer le catalogue de cours' : 'Charger la liste des sections'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8392a5' }}>
                  Fichier Excel "Rapport sur la Liste des Sections" de K12net (.xlsx)
                </p>
              </div>
            </div>
          </label>
        </div>
      </AdminSection>

      {/* ═══ Calculation Rules ═══ */}
      <AdminSection
        icon={<Scale className="w-5 h-5" style={{ color: '#5556fd' }} />}
        title={`Règles de calcul — ${academicYear}–${parseInt(academicYear) + 1}`}
        open={openSections.rules}
        onToggle={() => toggleSection('rules')}
      >
        <div className="space-y-6">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Configurez les seuils de distinction, sanction et promotion pour l'année <strong>{academicYear}–{parseInt(academicYear) + 1}</strong>.
          </p>

          {/* ── Distinction Thresholds ── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#06072d' }}>
              <GraduationCap className="w-4 h-4" style={{ color: '#5556fd' }} />
              Seuils de distinction (par trimestre)
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {(['7-10', '11-13'] as const).map(group => (
                <div key={group} className="p-3 rounded border" style={{ borderColor: '#e6e7ef', background: '#f9f9fd' }}>
                  <div className="text-xs font-medium mb-3" style={{ color: '#575d78' }}>
                    {group === '7-10' ? 'Collège (6ème – 3ème)' : 'Lycée (2nde – Tle)'}
                  </div>
                  <div className="space-y-2">
                    <ThresholdInput
                      label="Tableau d'Honneur (TH)"
                      value={rulesConfig.termDistinction[group].thMin}
                      onChange={v => updateDistinctionThreshold(group, 'thMin', v)}
                      color="#3b82f6"
                    />
                    <ThresholdInput
                      label="Tableau d'Excellence (THE)"
                      value={rulesConfig.termDistinction[group].theMin}
                      onChange={v => updateDistinctionThreshold(group, 'theMin', v)}
                      color="#8b5cf6"
                    />
                    <ThresholdInput
                      label="Félicitations (THF)"
                      value={rulesConfig.termDistinction[group].thfMin}
                      onChange={v => updateDistinctionThreshold(group, 'thfMin', v)}
                      color="#eab308"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sanction Thresholds ── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#06072d' }}>
              <Scale className="w-4 h-4" style={{ color: '#ef4444' }} />
              Seuils de sanction
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <ThresholdInput
                label="Blâme Travail Insuffisant (BTI)"
                hint="Moy. < seuil → BTI"
                value={rulesConfig.termSanction.btiMax}
                onChange={v => updateSanctionThreshold('btiMax', v)}
                color="#ef4444"
              />
              <ThresholdInput
                label="Avertissement Travail (AVT)"
                hint="Moy. < seuil → AVT"
                value={rulesConfig.termSanction.avtMax}
                onChange={v => updateSanctionThreshold('avtMax', v)}
                color="#f97316"
              />
              <ThresholdInput
                label="Blâme Mauvaise Conduite (BMC)"
                hint="Note conduite < seuil → BMC"
                value={rulesConfig.termSanction.bmcMax}
                onChange={v => updateSanctionThreshold('bmcMax', v)}
                color="#ef4444"
              />
              <ThresholdInput
                label="Avert. Mauvaise Conduite (AMC)"
                hint="Note conduite < seuil → AMC"
                value={rulesConfig.termSanction.amcMax}
                onChange={v => updateSanctionThreshold('amcMax', v)}
                color="#f97316"
              />
            </div>
          </div>

          {/* ── Promotion Thresholds ── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#06072d' }}>
              <Calculator className="w-4 h-4" style={{ color: '#22c55e' }} />
              Seuils de promotion (fin d'année)
            </h4>
            <div className="grid sm:grid-cols-3 gap-3">
              <ThresholdInput
                label="Admis (non redoublant)"
                hint="Moy. annuelle ≥ seuil → ADMIS"
                value={rulesConfig.promotion.promotionMin}
                onChange={v => updatePromotionThreshold('promotionMin', v)}
                color="#22c55e"
              />
              <ThresholdInput
                label="Redouble (non redoublant)"
                hint="Moy. ≥ seuil → REDOUBLE"
                value={rulesConfig.promotion.retainedMin}
                onChange={v => updatePromotionThreshold('retainedMin', v)}
                color="#eab308"
              />
              <ThresholdInput
                label="Admis (redoublant)"
                hint="Redoublant: moy. ≥ seuil → ADMIS"
                value={rulesConfig.promotion.repeatingPromotionMin}
                onChange={v => updatePromotionThreshold('repeatingPromotionMin', v)}
                color="#3b82f6"
              />
            </div>

            {/* Rule flags */}
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesConfig.useNonBonusForDistinctionCheck}
                  onChange={e => { setRulesConfig(prev => ({ ...prev, useNonBonusForDistinctionCheck: e.target.checked })); setHasUnsavedChanges(true); }}
                  className="rounded"
                />
                <span style={{ color: '#373857' }}>Utiliser les matières non-bonus pour la vérification des distinctions</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesConfig.checkFrenchCompositionForDistinction}
                  onChange={e => { setRulesConfig(prev => ({ ...prev, checkFrenchCompositionForDistinction: e.target.checked })); setHasUnsavedChanges(true); }}
                  className="rounded"
                />
                <span style={{ color: '#373857' }}>Vérifier la composition de Français pour les distinctions</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesConfig.terminalGradePromotion.repeatingAutoExpelled}
                  onChange={e => {
                    setRulesConfig(prev => ({
                      ...prev,
                      terminalGradePromotion: { ...prev.terminalGradePromotion, repeatingAutoExpelled: e.target.checked },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="rounded"
                />
                <span style={{ color: '#373857' }}>Redoublant en classe terminale → exclusion automatique</span>
              </label>
            </div>
          </div>

          {/* Weighted Average Formula */}
          <div className="p-4 rounded" style={{ background: '#f0f0ff', border: '1px solid #d4d4ff' }}>
            <h4 className="text-sm font-semibold mb-2" style={{ color: '#06072d' }}>Formule de calcul</h4>
            <div className="text-xs space-y-1" style={{ color: '#575d78' }}>
              <p><strong>Moyenne par matière (trimestre)</strong> = Moyenne simple des évaluations (normalisées /20)</p>
              <p><strong>Moyenne pondérée (trimestre)</strong> = Σ(moy. matière × coefficient) / Σ(coefficients)</p>
              <p><strong>Moyenne annuelle</strong> = Moyenne des moyennes pondérées des trimestres disponibles</p>
              <p><strong>Distinction</strong> = basée sur la moyenne pondérée + vérification des matières en échec</p>
            </div>
          </div>
        </div>
      </AdminSection>

      {/* ═══ Logo ═══ */}
      <AdminSection
        icon={<Image className="w-5 h-5" style={{ color: '#5556fd' }} />}
        title="Logo de l'établissement"
        open={openSections.logo}
        onToggle={() => toggleSection('logo')}
      >
        <div className="space-y-4">
          {logoPreview && (
            <div className="flex items-center gap-4 p-4 border rounded" style={{ borderColor: '#e6e7ef', background: '#f9f9fd' }}>
              <img src={logoPreview} alt="Logo" className="h-12 w-auto object-contain" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#06072d' }}>Logo actuel</p>
              </div>
              <button onClick={handleRemoveLogo} className="p-2 rounded hover:bg-red-50" style={{ color: '#dc3545' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-4">
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="global-logo-upload" />
            <label
              htmlFor="global-logo-upload"
              className="inline-flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-[#f0f0ff]"
              style={{ borderColor: '#e6e7ef', color: '#575d78' }}
            >
              <Image className="w-4 h-4" />
              {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
            </label>
            {logoFile && <span className="text-sm" style={{ color: '#8392a5' }}>{logoFile.name}</span>}
          </div>
        </div>
      </AdminSection>

      {/* ═══ Photos ═══ */}
      <AdminSection
        icon={<UsersIcon className="w-5 h-5" style={{ color: '#5556fd' }} />}
        title={`Photos des élèves (${photoCount})`}
        open={openSections.photos}
        onToggle={() => toggleSection('photos')}
      >
        <div className="space-y-4">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Importez un fichier ZIP contenant les photos des élèves. Le nom doit correspondre au matricule.
          </p>

          {zipResult && (
            <div className="p-3 rounded border text-sm" style={{
              background: zipResult.errors.length > 0 ? '#fff3cd' : '#e6f9ef',
              borderColor: zipResult.errors.length > 0 ? '#ffc107' : '#c3e6cb',
              color: zipResult.errors.length > 0 ? '#856404' : '#1a8a4d',
            }}>
              {zipResult.added} photo(s) importée(s)
              {zipResult.errors.length > 0 && (
                <div className="mt-1 text-xs">{zipResult.errors.slice(0, 5).join(', ')}</div>
              )}
            </div>
          )}

          {pendingPhotos && (
            <div className="flex gap-2">
              <button onClick={handleConfirmPhotoImport} className="px-3 py-1.5 text-sm font-medium text-white rounded" style={{ background: '#22c55e' }}>
                Confirmer l'import
              </button>
              <button onClick={() => { setPendingPhotos(null); setZipResult(null); }} className="px-3 py-1.5 text-sm rounded border" style={{ borderColor: '#e6e7ef', color: '#575d78' }}>
                Annuler
              </button>
            </div>
          )}

          <label
            className="block border-2 border-dashed rounded p-5 cursor-pointer transition-all hover:border-[#5556fd] hover:bg-[#f0f0ff]"
            style={{ borderColor: '#e6e7ef' }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleZipUpload}
          >
            <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
            <div className="flex items-center gap-4">
              {zipLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5556fd' }} />
              ) : (
                <UsersIcon className="w-6 h-6" style={{ color: '#c0ccda' }} />
              )}
              <div>
                <p className="font-medium text-sm" style={{ color: '#06072d' }}>Importer des photos (ZIP)</p>
                <p className="text-xs mt-0.5" style={{ color: '#8392a5' }}>Fichier ZIP contenant les photos des élèves</p>
              </div>
            </div>
          </label>
        </div>
      </AdminSection>

      {/* ═══ Users ═══ */}
      <AdminSection
        icon={<ShieldCheckIcon className="w-5 h-5" style={{ color: '#5556fd' }} />}
        title={`Utilisateurs (${users.length})`}
        open={openSections.users}
        onToggle={() => toggleSection('users')}
      >
        <div className="space-y-4">
          {/* Invite */}
          <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="prof@ecole.ci"
                className="w-full text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
                style={{ borderColor: '#e6e7ef' }}
              />
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium mb-1" style={{ color: '#373857' }}>Nom</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Nom complet"
                className="w-full text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#5556fd]"
                style={{ borderColor: '#e6e7ef' }}
              />
            </div>
            <button
              type="submit"
              disabled={inviteLoading || !inviteEmail.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded disabled:opacity-50"
              style={{ background: '#5556fd' }}
            >
              {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Inviter
            </button>
          </form>
          {inviteError && <p className="text-xs" style={{ color: '#dc3545' }}>{inviteError}</p>}
          {inviteSuccess && <p className="text-xs" style={{ color: '#22c55e' }}>{inviteSuccess}</p>}
          {userActionError && <p className="text-xs" style={{ color: '#dc3545' }}>{userActionError}</p>}

          {/* User list */}
          <div className="divide-y" style={{ borderColor: '#e6e7ef' }}>
            {usersLoading ? (
              <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: '#5556fd' }} /></div>
            ) : users.length === 0 ? (
              <p className="py-4 text-sm text-center" style={{ color: '#8392a5' }}>Aucun utilisateur</p>
            ) : users.map(u => (
              <div key={u.uid} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#06072d' }}>{u.displayName || u.email}</p>
                  <p className="text-xs truncate" style={{ color: '#8392a5' }}>{u.email}</p>
                </div>
                <select
                  value={u.role || 'user'}
                  onChange={e => handleRoleChange(u.uid, e.target.value as AppRole)}
                  disabled={u.uid === currentUser?.uid}
                  className="text-xs border rounded px-2 py-1"
                  style={{ borderColor: '#e6e7ef' }}
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={u.status || 'active'}
                  onChange={e => handleStatusChange(u.uid, e.target.value as UserStatus)}
                  disabled={u.uid === currentUser?.uid}
                  className="text-xs border rounded px-2 py-1"
                  style={{ borderColor: '#e6e7ef' }}
                >
                  <option value="active">Actif</option>
                  <option value="suspended">Suspendu</option>
                  <option value="pending">En attente</option>
                </select>
                {u.uid !== currentUser?.uid && (
                  <button
                    onClick={() => handleDeleteUser(u)}
                    className="p-1 rounded hover:bg-red-50"
                    style={{ color: '#dc3545' }}
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={loadUsers}
            disabled={usersLoading}
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: '#5556fd' }}
          >
            <RefreshIcon className="w-3.5 h-3.5" /> Rafraîchir
          </button>
        </div>
      </AdminSection>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function AdminSection({ icon, title, open, onToggle, children }: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card-cassie overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 border-b flex items-center justify-between text-left"
        style={{ borderColor: '#e6e7ef' }}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>{title}</h6>
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function ThresholdInput({ label, hint, value, onChange, color }: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium" style={{ color: '#373857' }}>{label}</label>
        <span className="text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      {hint && <p className="text-[10px] mb-1" style={{ color: '#8392a5' }}>{hint}</p>}
      <input
        type="range"
        min="0"
        max="20"
        step="0.5"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}
