import { useState, useCallback, useEffect } from 'react';
import { Image, X, Save, Check, Building2, FileSpreadsheet, CheckCircle, Scale, Hash, FolderOpen, Loader2, Users as UsersIcon, UserPlus, ShieldCheck as ShieldCheckIcon, UserX, RefreshCw as RefreshIcon, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { useTranslation } from 'react-i18next';
import { parseSectionList } from '../utils/excelParser';
import type { CourseStructure, ValidationRules, UEValidationMode, CreditThresholdMode, UserProfile, AppRole, UserStatus } from '../types';
import { DEFAULT_VALIDATION_RULES } from '../types';
import type { GlobalAppSettings } from '../contexts/GlobalSettingsContext';
import { useStudentPhotos } from '../contexts/StudentPhotosContext';
import { useAuth } from '../contexts/AuthContext';
import { extractMatriculeFromFilename } from '../utils/photos';
import { getAllUsers, updateUserStatus, updateUserAppRole, createPendingUser, deleteUserAccount } from '../lib/firestore';

interface Props {
  settings: GlobalAppSettings;
  onSettingsChange: (settings: GlobalAppSettings) => void;
}

type AdminSectionKey = 'logo' | 'courses' | 'school' | 'rules' | 'photos' | 'users';

export default function GlobalAdmin({ settings, onSettingsChange }: Props) {
  const { user: currentUser } = useAuth();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo || null);
  const [schoolName, setSchoolName] = useState(settings.schoolName || 'ÉCOLE MULTINATIONALE SUPÉRIEURE DES POSTES D\'ABIDJAN');
  const [sessionTitle, setSessionTitle] = useState(settings.sessionTitle || '');
  const [sessionDate, setSessionDate] = useState(settings.sessionDate || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [coursesParsing, setCoursesParsing] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [localCourses, setLocalCourses] = useState<CourseStructure | undefined>(settings.courses);
  const [rules, setRules] = useState<ValidationRules>(settings.validationRules ?? DEFAULT_VALIDATION_RULES);
  const { t } = useTranslation();

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
    logo: true,
    courses: true,
    school: true,
    rules: true,
    photos: true,
    users: true,
  });

  const toggleSection = useCallback((section: AdminSectionKey) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

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
      setUserActionError('Vous ne pouvez pas supprimer votre propre compte depuis cette interface.');
      return;
    }

    const confirmed = confirm(`Supprimer le compte de ${targetUser.displayName || targetUser.email} ?\n\nCette action retire l'utilisateur de la liste et des sessions partagées.`);
    if (!confirmed) return;

    setUserActionError('');
    try {
      await deleteUserAccount(targetUser.uid);
      setUsers(prev => prev.filter(user => user.uid !== targetUser.uid));
    } catch (err: unknown) {
      setUserActionError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  // Logo handling
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 2MB.');
      return;
    }

    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      setHasUnsavedChanges(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setHasUnsavedChanges(true);
  };

  // ZIP photos upload
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
        if (!matricule) {
          errors.push(`Impossible d'extraire l'ID depuis : ${basename}`);
          return;
        }
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
        } catch {
          errors.push(`Erreur lors du traitement de : ${basename}`);
        }
      }));

      setPendingPhotos(newPhotos);
      setZipResult({ added, errors });
    } catch (err) {
      setZipResult({ added: 0, errors: [`Impossible de lire le fichier ZIP : ${String(err)}`] });
    } finally {
      setZipLoading(false);
    }
  }, [photos]);

  const handleConfirmPhotoImport = useCallback(() => {
    if (!pendingPhotos) return;
    setPhotos(pendingPhotos);
    setPendingPhotos(null);
  }, [pendingPhotos, setPhotos]);

  const handleCancelPhotoImport = useCallback(() => {
    setPendingPhotos(null);
    setZipResult(null);
  }, []);

  // Section list upload
  const handleSectionListUpload = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = 'dataTransfer' in e ? e.dataTransfer.files[0] : e.target.files?.[0];
    if (!file) return;
    setCoursesParsing(true);
    setCoursesError(null);
    try {
      const c = await parseSectionList(file);
      setLocalCourses(c);
      setHasUnsavedChanges(true);
    } catch (err) {
      setCoursesError(String(err));
    } finally {
      setCoursesParsing(false);
    }
  }, []);

  const handleSave = () => {
    setSaveStatus('saving');
    const newSettings: GlobalAppSettings = {
      ...settings,
      logo: logoPreview || undefined,
      schoolName: schoolName || undefined,
      sessionTitle: sessionTitle || undefined,
      sessionDate: sessionDate || undefined,
      courses: localCourses,
      validationRules: rules,
    };
    onSettingsChange(newSettings);

    // Simulate save delay
    setTimeout(() => {
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#06072d' }}>{t('admin.global.title')}</h1>
          <p className="text-sm mt-1" style={{ color: '#8392a5' }}>
            {t('admin.global.subtitle')}
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
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('admin.global.logo.saving')}
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-4 h-4" />
                {t('admin.global.logo.saved')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('admin.global.save')}
              </>
            )}
          </button>
        )}
      </div>

      {/* Logo Settings */}
      <div className="card-cassie overflow-hidden">
        <button type="button" onClick={() => toggleSection('logo')} className="w-full px-5 py-4 border-b flex items-center justify-between text-left" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>{t('admin.global.logo.title')}</h6>
          </div>
          {openSections.logo ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </button>
        {openSections.logo && <div className="p-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#373857' }}>
                {t('admin.global.logo.upload')}
              </label>
              <p className="text-xs mb-3" style={{ color: '#8392a5' }}>
                {t('admin.global.logo.formats')}
              </p>

              {/* Logo preview */}
              {logoPreview && (
                <div className="mb-4 flex items-center gap-4 p-4 border rounded" style={{ borderColor: '#e6e7ef', background: '#f9f9fd' }}>
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-12 w-auto object-contain"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#06072d' }}>Logo actuel</p>
                    <p className="text-xs" style={{ color: '#8392a5' }}>
                      {t('admin.global.logo.preview')}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveLogo}
                    className="p-2 rounded hover:bg-red-50 transition-colors"
                    style={{ color: '#dc3545' }}
                    title="Supprimer le logo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Upload input */}
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="global-logo-upload"
                />
                <label
                  htmlFor="global-logo-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-[#f0f0ff] transition-colors"
                  style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                >
                  <Image className="w-4 h-4" />
                  {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
                </label>
                {logoFile && (
                  <span className="text-sm" style={{ color: '#8392a5' }}>
                    {logoFile.name} ({(logoFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>}
      </div>

      {/* Section List (Course Structure) */}
      <div className="card-cassie overflow-hidden">
        <button type="button" onClick={() => toggleSection('courses')} className="w-full px-5 py-4 border-b flex items-center justify-between text-left" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Liste des cours (Section List)</h6>
          </div>
          {openSections.courses ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </button>
        {openSections.courses && <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Ce fichier définit la structure des UE/ECUE et les crédits. Il sera disponible pour toutes les sessions.
          </p>

          {/* Current status */}
          {localCourses && (
            <div className="flex items-center gap-3 p-3 rounded border" style={{ background: '#e6f9ef', borderColor: '#c3e6cb' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#22d273' }} />
              <div className="text-sm" style={{ color: '#1a8a4d' }}>
                <span className="font-medium">Liste chargée</span>
                <span className="ml-2">
                  {Object.keys(localCourses.ues).length} UEs · {Object.keys(localCourses.ecues).length} ECUEs
                </span>
              </div>
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
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleSectionListUpload}
            />
            <div className="flex items-center gap-4">
              {coursesParsing ? (
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#5556fd', borderTopColor: 'transparent' }} />
              ) : (
                <FileSpreadsheet className="w-6 h-6" style={{ color: '#c0ccda' }} />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm" style={{ color: '#06072d' }}>
                  {localCourses ? 'Remplacer la liste des cours' : 'Charger la liste des cours'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8392a5' }}>
                  Fichier Excel des cours et crédits (Section List Report)
                </p>
              </div>
            </div>
          </label>
        </div>}
      </div>

      {/* School & Session Settings */}
      <div className="card-cassie overflow-hidden">
        <button type="button" onClick={() => toggleSection('school')} className="w-full px-5 py-4 border-b flex items-center justify-between text-left" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Informations de l'établissement</h6>
          </div>
          {openSections.school ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </button>
        {openSections.school && <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Ces informations apparaissent dans l'en-tête des fichiers exportés (Excel, PDF, Word).
          </p>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Nom de l'école</label>
            <input
              type="text"
              value={schoolName}
              onChange={e => { setSchoolName(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none"
              style={{ borderColor: '#e6e7ef', color: '#373857' }}
              placeholder="Ex: ÉCOLE MULTINATIONALE SUPÉRIEURE DES POSTES D'ABIDJAN"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Titre de la session</label>
              <input
                type="text"
                value={sessionTitle}
                onChange={e => { setSessionTitle(e.target.value); setHasUnsavedChanges(true); }}
                className="w-full text-sm border rounded px-3 py-2 focus:outline-none"
                style={{ borderColor: '#e6e7ef', color: '#373857' }}
                placeholder="Ex: Conseil de Classe — Semestre 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#373857' }}>Date de la session</label>
              <input
                type="text"
                value={sessionDate}
                onChange={e => { setSessionDate(e.target.value); setHasUnsavedChanges(true); }}
                className="w-full text-sm border rounded px-3 py-2 focus:outline-none"
                style={{ borderColor: '#e6e7ef', color: '#373857' }}
                placeholder="Ex: 15 Mars 2026"
              />
            </div>
          </div>
        </div>}
      </div>

      {/* Validation Rules Engine */}
      <div className="card-cassie overflow-hidden">
        <button type="button" onClick={() => toggleSection('rules')} className="w-full px-5 py-4 border-b flex items-center justify-between text-left" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Règles de validation</h6>
          </div>
          {openSections.rules ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </button>
        {openSections.rules && <div className="p-5 space-y-6">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Configurez les seuils de validation des ECUE, UE et les règles de passage semestriel et annuel.
            Ces règles s'appliquent à toutes les sessions.
          </p>

          {/* ECUE Rules */}
          <div className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="text-sm font-semibold" style={{ color: '#06072d' }}>Validation ECUE</h6>
            <div className="flex items-center gap-4">
              <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                Note minimale de validation
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={rules.ecue.passMark}
                  onChange={e => {
                    setRules({ ...rules, ecue: { ...rules.ecue, passMark: Number(e.target.value) } });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                  style={{ borderColor: '#e6e7ef', color: '#373857' }}
                />
                <span className="text-sm" style={{ color: '#8392a5' }}>/20</span>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: '#c0ccda' }}>
              Une ECUE est validée si sa moyenne est ≥ à ce seuil.
            </p>
          </div>

          {/* UE Rules */}
          <div className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="text-sm font-semibold" style={{ color: '#06072d' }}>Validation UE</h6>

            {/* Mode de validation */}
            <div>
              <label className="block text-sm mb-2" style={{ color: '#575d78' }}>Critère de validation</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['grade',   'Note (moyenne \u2265 seuil)'],
                  ['credits', 'Crédits obtenus \u2265 seuil'],
                  ['both',    'Note ET Crédits'],
                ] as [UEValidationMode, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setRules({ ...rules, ue: { ...rules.ue, validationMode: val } }); setHasUnsavedChanges(true); }}
                    className="text-xs px-3 py-1.5 rounded border font-medium transition-colors"
                    style={{
                      background: (rules.ue.validationMode ?? 'grade') === val ? '#5556fd' : 'white',
                      color: (rules.ue.validationMode ?? 'grade') === val ? 'white' : '#575d78',
                      borderColor: (rules.ue.validationMode ?? 'grade') === val ? '#5556fd' : '#e6e7ef',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* passMark — visible si mode inclut 'grade' */}
            {((rules.ue.validationMode ?? 'grade') === 'grade' || rules.ue.validationMode === 'both') && (
              <div className="flex items-center gap-4">
                <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                  Note minimale de validation
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={rules.ue.passMark}
                    onChange={e => {
                      setRules({ ...rules, ue: { ...rules.ue, passMark: Number(e.target.value) } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                  <span className="text-sm" style={{ color: '#8392a5' }}>/20</span>
                </div>
              </div>
            )}

            {/* minCredits — visible si mode inclut 'credits' */}
            {(rules.ue.validationMode === 'credits' || rules.ue.validationMode === 'both') && (
              <div className="flex items-center gap-4">
                <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                  Crédits minimum obtenus dans l'UE
                </label>
                <div className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" style={{ color: '#8392a5' }} />
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={rules.ue.minCredits ?? 0}
                    onChange={e => {
                      setRules({ ...rules, ue: { ...rules.ue, minCredits: Number(e.target.value) } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                  <span className="text-sm" style={{ color: '#8392a5' }}>crédits</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.ue.capitalizeEcueCredits}
                  onChange={e => {
                    setRules({ ...rules, ue: { ...rules.ue, capitalizeEcueCredits: e.target.checked } });
                    setHasUnsavedChanges(true);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full peer
                  peer-checked:after:translate-x-full after:content-['']
                  after:absolute after:top-[2px] after:left-[2px]
                  after:rounded-full after:h-4 after:w-4 after:transition-all
                  peer-checked:bg-[#5556fd] bg-gray-300 after:bg-white" />
              </label>
              <span className="text-sm" style={{ color: '#575d78' }}>
                Capitaliser les crédits ECUE individuellement
              </span>
            </div>
            <p className="text-[11px]" style={{ color: '#c0ccda' }}>
              Si activé, lorsqu'une UE n'est pas validée, les ECUE individuellement validées conservent leurs crédits.
            </p>
          </div>

          {/* Semester Passage Rules */}
          <div className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="text-sm font-semibold" style={{ color: '#06072d' }}>Passage — Semestre</h6>

            {/* Mode */}
            <div>
              <label className="block text-sm mb-2" style={{ color: '#575d78' }}>Mode de calcul du seuil AUTORISÉ</label>
              <div className="flex gap-2">
                {([
                  ['ratio',    'Pourcentage des crédits'],
                  ['absolute', 'Nombre de crédits fixe'],
                ] as [CreditThresholdMode, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setRules({ ...rules, semester: { ...rules.semester, autoriseMode: val } }); setHasUnsavedChanges(true); }}
                    className="text-xs px-3 py-1.5 rounded border font-medium transition-colors"
                    style={{
                      background: (rules.semester.autoriseMode ?? 'ratio') === val ? '#5556fd' : 'white',
                      color: (rules.semester.autoriseMode ?? 'ratio') === val ? 'white' : '#575d78',
                      borderColor: (rules.semester.autoriseMode ?? 'ratio') === val ? '#5556fd' : '#e6e7ef',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {(rules.semester.autoriseMode ?? 'ratio') === 'ratio' ? (
              <div className="flex items-center gap-4">
                <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                  % minimum de crédits pour AUTORISÉ
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(rules.semester.autoriseMinCreditsRatio * 100)}
                    onChange={e => {
                      setRules({ ...rules, semester: { ...rules.semester, autoriseMinCreditsRatio: Number(e.target.value) / 100 } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                  <span className="text-sm" style={{ color: '#8392a5' }}>%</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                  Nombre de crédits minimum pour AUTORISÉ
                </label>
                <div className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" style={{ color: '#8392a5' }} />
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={rules.semester.autoriseMinCreditsAbsolute ?? 0}
                    onChange={e => {
                      setRules({ ...rules, semester: { ...rules.semester, autoriseMinCreditsAbsolute: Number(e.target.value) } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                  <span className="text-sm" style={{ color: '#8392a5' }}>crédits</span>
                </div>
              </div>
            )}

            <p className="text-[11px]" style={{ color: '#c0ccda' }}>
              ADMIS = 100% des crédits · AUTORISÉ = ≥ ce seuil · AJOURNÉ = en dessous.
            </p>
          </div>

          {/* Annual Passage Rules */}
          <div className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="text-sm font-semibold" style={{ color: '#06072d' }}>Passage — Annuel</h6>

            {/* Mode */}
            <div>
              <label className="block text-sm mb-2" style={{ color: '#575d78' }}>Mode de calcul du seuil AUTORISÉ</label>
              <div className="flex gap-2">
                {([
                  ['ratio',    'Pourcentage des crédits'],
                  ['absolute', 'Nombre de crédits fixe'],
                ] as [CreditThresholdMode, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setRules({ ...rules, annual: { ...rules.annual, autoriseMode: val } }); setHasUnsavedChanges(true); }}
                    className="text-xs px-3 py-1.5 rounded border font-medium transition-colors"
                    style={{
                      background: (rules.annual.autoriseMode ?? 'ratio') === val ? '#5556fd' : 'white',
                      color: (rules.annual.autoriseMode ?? 'ratio') === val ? 'white' : '#575d78',
                      borderColor: (rules.annual.autoriseMode ?? 'ratio') === val ? '#5556fd' : '#e6e7ef',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {(rules.annual.autoriseMode ?? 'ratio') === 'ratio' ? (
              <div className="flex items-center gap-4">
                <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                  % minimum de crédits pour AUTORISÉ
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(rules.annual.autoriseMinCreditsRatio * 100)}
                    onChange={e => {
                      setRules({ ...rules, annual: { ...rules.annual, autoriseMinCreditsRatio: Number(e.target.value) / 100 } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                  <span className="text-sm" style={{ color: '#8392a5' }}>%</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                  Nombre de crédits minimum pour AUTORISÉ
                </label>
                <div className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" style={{ color: '#8392a5' }} />
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={rules.annual.autoriseMinCreditsAbsolute ?? 0}
                    onChange={e => {
                      setRules({ ...rules, annual: { ...rules.annual, autoriseMinCreditsAbsolute: Number(e.target.value) } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                  <span className="text-sm" style={{ color: '#8392a5' }}>crédits</span>
                </div>
              </div>
            )}

            <p className="text-[11px]" style={{ color: '#c0ccda' }}>
              Même logique que le semestre, appliquée au cumul annuel S1+S2.
            </p>
          </div>

          {/* Repêchage Rules */}
          <div className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="text-sm font-semibold" style={{ color: '#06072d' }}>Rattrapage (Repêchage)</h6>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.repechage.enabled}
                  onChange={e => {
                    setRules({ ...rules, repechage: { ...rules.repechage, enabled: e.target.checked } });
                    setHasUnsavedChanges(true);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full peer
                  peer-checked:after:translate-x-full after:content-['']
                  after:absolute after:top-[2px] after:left-[2px]
                  after:rounded-full after:h-4 after:w-4 after:transition-all
                  peer-checked:bg-[#5556fd] bg-gray-300 after:bg-white" />
              </label>
              <span className="text-sm" style={{ color: '#575d78' }}>
                Activer la règle de repêchage
              </span>
            </div>
            {rules.repechage.enabled && (
              <div className="space-y-3 mt-2 pl-1">
                <div className="flex items-center gap-4">
                  <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                    Moyenne UE minimale
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={rules.repechage.minUEAverage}
                      onChange={e => {
                        setRules({ ...rules, repechage: { ...rules.repechage, minUEAverage: Number(e.target.value) } });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                      style={{ borderColor: '#e6e7ef', color: '#373857' }}
                    />
                    <span className="text-sm" style={{ color: '#8392a5' }}>/20</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-sm flex-1" style={{ color: '#575d78' }}>
                    Nombre max d'UE échouées
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rules.repechage.maxFailedUEs}
                    onChange={e => {
                      setRules({ ...rules, repechage: { ...rules.repechage, maxFailedUEs: Number(e.target.value) } });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-20 text-sm text-center border rounded px-2 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                  />
                </div>
              </div>
            )}
            <p className="text-[11px]" style={{ color: '#c0ccda' }}>
              Un étudiant AUTORISÉ peut bénéficier du repêchage s'il a au plus N UE échouées et que
              la moyenne de l'UE échouée est ≥ au seuil configuré.
            </p>
          </div>

          {/* Reset to defaults */}
          <button
            onClick={() => {
              setRules(DEFAULT_VALIDATION_RULES);
              setHasUnsavedChanges(true);
            }}
            className="text-sm font-medium px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
            style={{ borderColor: '#e6e7ef', color: '#8392a5' }}
          >
            Réinitialiser les valeurs par défaut
          </button>
        </div>}
      </div>

      {/* Student Photos */}
      <div className="card-cassie overflow-hidden">
        <button type="button" onClick={() => toggleSection('photos')} className="w-full px-5 py-4 border-b flex items-center justify-between text-left" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Photos des étudiants</h6>
          </div>
          {openSections.photos ? <ChevronUp className="w-4 h-4" style={{ color: '#8392a5' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8392a5' }} />}
        </button>
        {openSections.photos && <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Chargez un fichier ZIP contenant les photos des étudiants. Chaque photo doit être nommée
            avec le numéro matricule de l'étudiant (ex&nbsp;: <code className="px-1 rounded" style={{ background: '#f3f6f9', color: '#5556fd' }}>25FS0060S.jpg</code>).
            Les photos seront affichées dans la fiche de chaque étudiant.
          </p>

          {/* Status */}
          {photoCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded border" style={{ background: '#e6f9ef', borderColor: '#c3e6cb' }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: '#1a8a4d' }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>{photoCount}</strong> photo{photoCount > 1 ? 's' : ''} chargée{photoCount > 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => { setPhotos({}); setZipResult(null); }}
                className="text-xs font-medium px-2 py-1 rounded transition-colors hover:bg-red-50"
                style={{ color: '#dc3545' }}
              >
                Tout supprimer
              </button>
            </div>
          )}

          {pendingPhotos && zipResult?.added ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded border" style={{ background: '#fff8e8', borderColor: '#f7d58b' }}>
              <div className="text-sm" style={{ color: '#9a6700' }}>
                <strong>{zipResult.added}</strong> photo{zipResult.added > 1 ? 's' : ''} pr\u00eate{zipResult.added > 1 ? 's' : ''} \u00e0 \u00eatre enregistr\u00e9e{zipResult.added > 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelPhotoImport}
                  className="text-xs font-medium px-3 py-1.5 rounded border transition-colors hover:bg-white"
                  style={{ borderColor: '#f7d58b', color: '#9a6700' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmPhotoImport}
                  className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                  style={{ background: '#5556fd', color: 'white' }}
                >
                  Confirmer l'import
                </button>
              </div>
            </div>
          ) : null}

          {/* Result feedback */}
          {zipResult && (
            <div className="space-y-1">
              {zipResult.added > 0 && (
                <div className="text-sm px-3 py-2 rounded" style={{ background: pendingPhotos ? '#fff8e8' : '#e6f9ef', color: pendingPhotos ? '#9a6700' : '#1a8a4d' }}>
                  {pendingPhotos ? 'En attente' : '✓'} {zipResult.added} photo{zipResult.added > 1 ? 's' : ''} {pendingPhotos ? 'extraite' : 'importée'}{zipResult.added > 1 ? 's' : ''} avec succès
                </div>
              )}
              {zipResult.errors.map((err, i) => (
                <div key={i} className="text-xs px-3 py-2 rounded" style={{ background: '#fce8ea', color: '#dc3545' }}>
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <label
            className="block border-2 border-dashed rounded p-5 cursor-pointer transition-all hover:border-[#5556fd] hover:bg-[#f0f0ff]"
            style={{ borderColor: zipLoading ? '#5556fd' : '#e6e7ef', background: zipLoading ? '#f0f0ff' : 'white' }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleZipUpload}
          >
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleZipUpload}
              disabled={zipLoading}
            />
            <div className="flex items-center gap-4">
              {zipLoading
                ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5556fd' }} />
                : <FolderOpen className="w-6 h-6" style={{ color: '#c0ccda' }} />
              }
              <div className="flex-1">
                <p className="font-medium text-sm" style={{ color: '#06072d' }}>
                  {zipLoading ? 'Extraction en cours…' : 'Glissez ou cliquez pour charger un fichier ZIP'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8392a5' }}>
                  Formats acceptés : JPG, PNG, WebP, GIF — nommés par matricule étudiant
                </p>
              </div>
            </div>
          </label>
        </div>}
      </div>

      {/* User Management */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e6e7ef' }}>
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm" style={{ color: '#06072d' }}>Gestion des utilisateurs</h6>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#f0f0ff', color: '#5556fd' }}>
              {users.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={loadUsers} disabled={usersLoading} className="p-1.5 rounded hover:bg-[#f0f0ff] transition-colors" style={{ color: '#8392a5' }} title="Rafraîchir">
              <RefreshIcon className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => toggleSection('users')} className="p-1.5 rounded hover:bg-[#f0f0ff] transition-colors" style={{ color: '#8392a5' }} title={openSections.users ? 'Réduire' : 'Développer'}>
              {openSections.users ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {openSections.users && <div className="p-5 space-y-5">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Gérez les comptes utilisateurs, validez les inscriptions et attribuez les rôles. Les utilisateurs avec le rôle <strong>Admin</strong> ont accès aux paramètres globaux.
          </p>
          {userActionError && (
            <p className="text-xs px-3 py-2 rounded" style={{ background: '#fce8ea', color: '#dc3545' }}>{userActionError}</p>
          )}

          {/* Invite form */}
          <div className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
            <h6 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#06072d' }}>
              <UserPlus className="w-4 h-4" style={{ color: '#5556fd' }} />
              Inviter un utilisateur
            </h6>
            <form onSubmit={handleInvite} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Nom complet"
                className="flex-1 min-w-[140px] px-3 py-2 rounded border text-sm outline-none"
                style={{ borderColor: '#e6e7ef', color: '#06072d' }}
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Adresse email"
                required
                className="flex-1 min-w-[180px] px-3 py-2 rounded border text-sm outline-none"
                style={{ borderColor: '#e6e7ef', color: '#06072d' }}
              />
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#5556fd' }}
              >
                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Inviter
              </button>
            </form>
            {inviteError && (
              <p className="text-xs px-3 py-2 rounded" style={{ background: '#fce8ea', color: '#dc3545' }}>{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="text-xs px-3 py-2 rounded" style={{ background: '#e6f9ef', color: '#1a8a4d' }}>{inviteSuccess}</p>
            )}
          </div>

          {/* Users list */}
          {usersLoading ? (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: '#8392a5' }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#c0ccda' }}>Aucun utilisateur enregistré</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => {
                const statusColor: Record<UserStatus, { bg: string; text: string; label: string }> = {
                  active:    { bg: '#e6f9ef', text: '#1a8a4d', label: 'Actif' },
                  pending:   { bg: '#fff8e1', text: '#9a6700', label: 'En attente' },
                  suspended: { bg: '#fce8ea', text: '#dc3545', label: 'Suspendu' },
                };
                const sc = statusColor[u.status] ?? statusColor.active;
                const initials = (u.displayName || u.email).slice(0, 2).toUpperCase();
                return (
                  <div key={u.uid} className="flex items-center gap-3 px-4 py-3 rounded border" style={{ borderColor: '#e6e7ef', background: '#f9f9fd' }}>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white overflow-hidden" style={{ background: '#5556fd' }}>
                      {u.photoURL
                        ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        : initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#06072d' }}>{u.displayName || '—'}</p>
                      <p className="text-xs truncate" style={{ color: '#8392a5' }}>{u.email}</p>
                    </div>
                    {/* Status badge */}
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                    {/* Role selector */}
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.uid, e.target.value as AppRole)}
                      className="text-xs px-2 py-1 rounded border outline-none flex-shrink-0"
                      style={{ borderColor: '#e6e7ef', color: '#575d78', background: 'white' }}
                    >
                      <option value="user">Utilisateur</option>
                      <option value="admin">Admin</option>
                    </select>
                    {/* Status actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {u.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(u.uid, 'active')}
                          className="p-1.5 rounded hover:bg-green-50 transition-colors"
                          style={{ color: '#22d273' }}
                          title="Valider l'inscription"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {u.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(u.uid, 'suspended')}
                          className="p-1.5 rounded hover:bg-red-50 transition-colors"
                          style={{ color: '#dc3545' }}
                          title="Suspendre le compte"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      {u.status === 'suspended' && (
                        <button
                          onClick={() => handleStatusChange(u.uid, 'active')}
                          className="p-1.5 rounded hover:bg-green-50 transition-colors"
                          style={{ color: '#22d273' }}
                          title="Réactiver le compte"
                        >
                          <ShieldCheckIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors"
                        style={{ color: '#dc3545' }}
                        title="Supprimer le compte"
                        disabled={u.uid === currentUser?.uid}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}