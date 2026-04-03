import { useState, useCallback, useMemo } from 'react';
import { Settings, ChevronDown, ChevronRight, RefreshCw, Upload as UploadIcon, FileSpreadsheet, Loader2, Plus, Trash2, CalendarRange, CheckCircle } from 'lucide-react';
import { DropZone } from './FileUpload';
import type { FileState } from './FileUpload';
import type { AppData, CourseStructure, ParsedExcel, CreditOverride, TermConfig, TermDefinition, ValidationRules } from '../types';
import { parseGradeDistributionAllSheets, DEFAULT_TERM_CONFIG } from '../utils/excelParser';
import { calculateStudents, calculateAllClasses } from '../utils/calculator';

interface Props {
  data: AppData | null;
  onDataReady: (data: AppData) => void | Promise<void>;
  onCreditOverridesChange: (overrides: CreditOverride[]) => void;
  globalCourses?: CourseStructure | null;
  onTermConfigChange?: (termConfig: TermConfig) => void;
  validationRules?: ValidationRules;
}

export default function Admin({ data, onDataReady, onCreditOverridesChange, onTermConfigChange, globalCourses, validationRules }: Props) {
  const [gradeFile, setGradeFile] = useState<FileState>({ file: null, status: 'idle' });
  const [parsedSheets, setParsedSheets] = useState<ParsedExcel[] | null>(null);
  const [processing, setProcessing] = useState(false);

  // Credit override editing
  const [overrides, setOverrides] = useState<CreditOverride[]>(data?.creditOverrides ?? []);
  const [selectedHomeroom, setSelectedHomeroom] = useState('');
  const [expandedUEs, setExpandedUEs] = useState<Set<string>>(new Set());

  // Term config editing
  const [termConfig, setTermConfig] = useState<TermConfig>(data?.termConfig ?? DEFAULT_TERM_CONFIG);
  const [termDirty, setTermDirty] = useState(false);

  // Section collapse state
  const [sectionsOpen, setSectionsOpen] = useState({ upload: true, terms: true, courses: true });
  const toggleSection = (key: keyof typeof sectionsOpen) =>
    setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));

  // Prefer global courses, fall back to existing session data
  const activeCourses = globalCourses ?? data?.courses ?? null;
  const activeParsedSheets = parsedSheets
    ?? (data?.multiClass
      ? data.multiClass.classes.map(c => c.parsedExcel)
      : data?.parsedExcel ? [data.parsedExcel] : null);
  const hasNewFiles = gradeFile.status === 'done';

  // Get unique homerooms from courses
  const homerooms = useMemo(() => {
    if (!activeCourses) return [];
    const set = new Set<string>();
    for (const ecue of Object.values(activeCourses.ecues)) {
      for (const h of ecue.homerooms) set.add(h);
    }
    return [...set].sort();
  }, [activeCourses]);

  const handleGradeFileDrop = useCallback(
    async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      const file =
        'dataTransfer' in e ? e.dataTransfer.files[0] : e.target.files?.[0];
      if (!file) return;

      setGradeFile({ file, status: 'loading' });
      try {
        const sheets = await parseGradeDistributionAllSheets(file, termConfig);
        const totalStudents = sheets.reduce((s, p) => s + p.studentRows.length, 0);
        const uniqueGroups = new Set(sheets.map(s => s.groupName)).size;
        const info = sheets.length > 1
          ? `${uniqueGroups} classe(s) · ${totalStudents} étudiants`
          : `${totalStudents} étudiants · ${sheets[0].ecueColumns.length} ECUEs`;
        setGradeFile({ file, status: 'done', info });
        setParsedSheets(sheets);
      } catch (err) {
        setGradeFile({ file, status: 'error', error: String(err) });
      }
    },
    [termConfig]
  );

  const handleProceed = () => {
    const cs = activeCourses;
    const sheets = activeParsedSheets;
    if (!cs || !sheets) return;
    setProcessing(true);

    try {
      if (sheets.length === 1) {
        const students = calculateStudents(sheets[0], cs, validationRules);
        onDataReady({
          courses: cs,
          parsedExcel: sheets[0],
          students,
          multiClass: null,
          creditOverrides: overrides,
          termConfig: data?.termConfig ?? DEFAULT_TERM_CONFIG,
        });
      } else {
        const multiClass = calculateAllClasses(sheets, cs, overrides, validationRules);
        onDataReady({
          courses: cs,
          parsedExcel: multiClass.classes[0].parsedExcel,
          students: multiClass.classes[0].students,
          multiClass,
          creditOverrides: overrides,
          termConfig: data?.termConfig ?? DEFAULT_TERM_CONFIG,
        });
      }
    } finally {
      setProcessing(false);
      // Reset upload states after successful update
      setGradeFile({ file: null, status: 'idle' });
      setParsedSheets(null);
    }
  };

  const canProceed = (gradeFile.status === 'done' || !!data?.parsedExcel) && !!activeCourses;

  // ── Credit editing helpers ──

  const getEffectiveCredit = (ecueCode: string, baseCredits: number): number => {
    // Find most specific override: homeroom-specific first, then global
    if (selectedHomeroom) {
      const specific = overrides.find(o => o.ecueCode === ecueCode && o.homeroom === selectedHomeroom);
      if (specific) return specific.credits;
    }
    const global = overrides.find(o => o.ecueCode === ecueCode && o.homeroom === '');
    if (global) return global.credits;
    return baseCredits;
  };

  const handleCreditChange = (ecueCode: string, newCredits: number) => {
    const homeroom = selectedHomeroom;
    setOverrides(prev => {
      const filtered = prev.filter(o => !(o.ecueCode === ecueCode && o.homeroom === homeroom));
      // Only add override if different from base
      const base = activeCourses?.ecues[ecueCode]?.credits ?? 0;
      if (newCredits !== base || homeroom !== '') {
        filtered.push({ ecueCode, homeroom, credits: newCredits });
      }
      return filtered;
    });
  };

  const toggleUE = (ueCode: string) => {
    setExpandedUEs(prev => {
      const next = new Set(prev);
      if (next.has(ueCode)) next.delete(ueCode);
      else next.add(ueCode);
      return next;
    });
  };

  const handleApplyOverrides = () => {
    onCreditOverridesChange(overrides);
    // Recalculate if we have data
    if (data && data.courses && data.multiClass) {
      const sheets = data.multiClass.classes.map(c => c.parsedExcel);
      const multiClass = calculateAllClasses(sheets, data.courses, overrides, validationRules);
      onDataReady({
        ...data,
        multiClass,
        parsedExcel: multiClass.classes[0].parsedExcel,
        students: multiClass.classes[0].students,
        creditOverrides: overrides,
      });
    }
  };

  const hasChanges = overrides.length > 0;

  // ── Term config helpers ──

  const handleAddTerm = () => {
    const nextNum = termConfig.terms.length + 1;
    const newTerm: TermDefinition = {
      id: `S${nextNum}`,
      label: `Semestre ${nextNum}`,
      patterns: [`- S${nextNum}`, `- SEM${nextNum}`],
    };
    const updated = { ...termConfig, terms: [...termConfig.terms, newTerm] };
    setTermConfig(updated);
    setTermDirty(true);
  };

  const handleRemoveTerm = (termId: string) => {
    const updated = {
      ...termConfig,
      terms: termConfig.terms.filter(t => t.id !== termId),
      defaultTermId: termConfig.defaultTermId === termId
        ? (termConfig.terms.find(t => t.id !== termId)?.id ?? 'S1')
        : termConfig.defaultTermId,
    };
    setTermConfig(updated);
    setTermDirty(true);
  };

  const handleUpdateTerm = (termId: string, field: keyof TermDefinition, value: string | string[]) => {
    const updated = {
      ...termConfig,
      terms: termConfig.terms.map(t =>
        t.id === termId ? { ...t, [field]: value } : t,
      ),
    };
    // If ID changed, update defaultTermId reference
    if (field === 'id' && termConfig.defaultTermId === termId) {
      updated.defaultTermId = value as string;
    }
    setTermConfig(updated);
    setTermDirty(true);
  };

  const handleSetDefaultTerm = (termId: string) => {
    setTermConfig({ ...termConfig, defaultTermId: termId });
    setTermDirty(true);
  };

  const handleApplyTermConfig = () => {
    onTermConfigChange?.(termConfig);
    setTermDirty(false);
    // If we have data, trigger re-parse with new term config
    if (data && data.multiClass && data.courses) {
      // Re-split and recalculate using the new term config
      // This requires re-uploading, so just save the config for now
    }
  };

  return (
    <div className="space-y-5">
      {/* File Upload Section */}
      <div className="card-cassie overflow-hidden">
        <button
          onClick={() => toggleSection('upload')}
          className="w-full px-5 py-4 border-b flex items-center gap-2 hover:bg-[#f9f9fd] transition-colors text-left"
          style={{ borderColor: '#e6e7ef' }}
        >
          <UploadIcon className="w-5 h-5" style={{ color: '#5556fd' }} />
          <h6 className="font-medium text-sm flex-1" style={{ color: '#06072d' }}>Chargement des fichiers</h6>
          {sectionsOpen.upload
            ? <ChevronDown className="w-4 h-4" style={{ color: '#c0ccda' }} />
            : <ChevronRight className="w-4 h-4" style={{ color: '#c0ccda' }} />}
        </button>
        {sectionsOpen.upload && <div className="p-5 space-y-4">
          {/* Global courses status */}
          {activeCourses ? (
            <div className="flex items-center gap-2 p-3 rounded border" style={{ background: '#e6f9ef', borderColor: '#c3e6cb' }}>
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22d273' }} />
              <span className="text-sm" style={{ color: '#1a8a4d' }}>
                Liste des cours — {Object.keys(activeCourses.ues).length} UEs · {Object.keys(activeCourses.ecues).length} ECUEs
              </span>
              <span className="text-xs ml-auto" style={{ color: '#8392a5' }}>(Paramètres globaux)</span>
            </div>
          ) : (
            <div className="p-3 rounded border text-sm" style={{ background: '#fff8e1', borderColor: '#ffc107', color: '#b86e1d' }}>
              &#9888; Liste des cours non disponible. Un administrateur doit la charger dans les paramètres globaux.
            </div>
          )}

          <DropZone
            label="Relevé de notes"
            hint={data?.parsedExcel ? 'Déposez un nouveau fichier pour remplacer' : 'Fichier Excel des résultats (une ou plusieurs feuilles)'}
            state={gradeFile.status !== 'idle'
              ? gradeFile
              : (data?.parsedExcel
                ? { file: null, status: 'done' as const, info: data.multiClass
                    ? `${data.multiClass.classes.length} classes · ${data.multiClass.classes.reduce((s, c) => s + c.students.length, 0)} étudiants`
                    : `${data.students?.length ?? 0} étudiants · ${data.parsedExcel.ecueColumns.length} ECUEs`
                  }
                : gradeFile)}
            onDrop={handleGradeFileDrop}
          />

          {canProceed && (!data?.students || hasNewFiles) && (
            <button
              onClick={handleProceed}
              disabled={processing}
              className="w-full py-2.5 text-white font-semibold rounded transition-colors
                disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#5556fd' }}
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
              ) : hasNewFiles && data?.students ? (
                <><RefreshCw className="w-4 h-4" /> Mettre à jour les données</>
              ) : (
                <><FileSpreadsheet className="w-4 h-4" /> Accéder au tableau de bord</>
              )}
            </button>
          )}
        </div>}
      </div>

      {/* Term Configuration Section */}
      <div className="card-cassie overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e6e7ef' }}>
          <button
            onClick={() => toggleSection('terms')}
            className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity text-left"
          >
            <CalendarRange className="w-5 h-5" style={{ color: '#5556fd' }} />
            <h6 className="font-medium text-sm flex-1" style={{ color: '#06072d' }}>Gestion des périodes (Termes)</h6>
            {sectionsOpen.terms
              ? <ChevronDown className="w-4 h-4" style={{ color: '#c0ccda' }} />
              : <ChevronRight className="w-4 h-4" style={{ color: '#c0ccda' }} />}
          </button>
          {termDirty && (
            <button
              onClick={handleApplyTermConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded transition-colors ml-2"
              style={{ background: '#5556fd' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Appliquer
            </button>
          )}
        </div>
        {sectionsOpen.terms && <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: '#8392a5' }}>
            Définissez les périodes (semestres, trimestres) et leurs mots-clés de détection.
            Les ECUEs contenant un mot-clé dans leur nom seront automatiquement assignés à la période correspondante.
          </p>

          {termConfig.terms.map((term, idx) => (
            <div key={idx} className="border rounded p-4 space-y-3" style={{ borderColor: '#e6e7ef' }}>
              <div className="flex items-center gap-3">
                {/* Term ID */}
                <div className="flex-shrink-0">
                  <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#8392a5' }}>ID</label>
                  <input
                    type="text"
                    value={term.id}
                    onChange={e => handleUpdateTerm(term.id, 'id', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    className="w-16 text-sm text-center border rounded px-2 py-1.5 font-mono font-bold focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#5556fd' }}
                  />
                </div>

                {/* Term Label */}
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#8392a5' }}>Libellé</label>
                  <input
                    type="text"
                    value={term.label}
                    onChange={e => handleUpdateTerm(term.id, 'label', e.target.value)}
                    className="w-full text-sm border rounded px-3 py-1.5 focus:outline-none"
                    style={{ borderColor: '#e6e7ef', color: '#373857' }}
                    placeholder="ex: Semestre 1"
                  />
                </div>

                {/* Default term radio */}
                <div className="flex-shrink-0 text-center">
                  <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#8392a5' }}>Défaut</label>
                  <input
                    type="radio"
                    name="defaultTerm"
                    checked={termConfig.defaultTermId === term.id}
                    onChange={() => handleSetDefaultTerm(term.id)}
                    className="w-4 h-4 mt-1"
                    style={{ accentColor: '#5556fd' }}
                  />
                </div>

                {/* Delete button */}
                <div className="flex-shrink-0 pt-4">
                  <button
                    onClick={() => handleRemoveTerm(term.id)}
                    disabled={termConfig.terms.length <= 1}
                    className="p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Supprimer cette période"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: '#dc3545' }} />
                  </button>
                </div>
              </div>

              {/* Patterns */}
              <div>
                <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#8392a5' }}>
                  Mots-clés de détection (séparés par virgule)
                </label>
                <input
                  type="text"
                  value={term.patterns.join(', ')}
                  onChange={e => handleUpdateTerm(term.id, 'patterns', e.target.value.split(',').map(p => p.trim()).filter(Boolean))}
                  className="w-full text-sm border rounded px-3 py-1.5 font-mono focus:outline-none"
                  style={{ borderColor: '#e6e7ef', color: '#575d78' }}
                  placeholder="ex: - S1, - SEM1, [SEM1]"
                />
                <p className="text-[10px] mt-1" style={{ color: '#c0ccda' }}>
                  Si le nom d'une ECUE contient l'un de ces mots-clés, elle sera assignée à ce terme.
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={handleAddTerm}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded border transition-colors hover:bg-[#f0f0ff]"
            style={{ borderColor: '#d4d4ff', color: '#5556fd' }}
          >
            <Plus className="w-4 h-4" />
            Ajouter une période
          </button>

          {termDirty && (
            <div className="p-3 rounded" style={{ background: '#fff8e1', border: '1px solid #ffc107' }}>
              <p className="text-sm font-medium" style={{ color: '#b86e1d' }}>
                Configuration modifiée
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#c07a2a' }}>
                Cliquez sur "Appliquer" puis rechargez le fichier de notes pour utiliser la nouvelle configuration.
              </p>
            </div>
          )}
        </div>}
      </div>

      {/* Course Structure Editor */}
      {activeCourses && (
        <div className="card-cassie overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e6e7ef' }}>
            <button
              onClick={() => toggleSection('courses')}
              className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity text-left"
            >
              <Settings className="w-5 h-5" style={{ color: '#5556fd' }} />
              <h6 className="font-medium text-sm flex-1" style={{ color: '#06072d' }}>Structure des cours & Credits</h6>
              {sectionsOpen.courses
                ? <ChevronDown className="w-4 h-4" style={{ color: '#c0ccda' }} />
                : <ChevronRight className="w-4 h-4" style={{ color: '#c0ccda' }} />}
            </button>
            {hasChanges && (
              <button
                onClick={handleApplyOverrides}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded transition-colors ml-2"
                style={{ background: '#5556fd' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recalculer
              </button>
            )}
          </div>

          {sectionsOpen.courses && <div className="p-5">
            {/* Homeroom filter */}
            {homerooms.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <label className="text-sm font-medium" style={{ color: '#373857' }}>Homeroom :</label>
                <select
                  value={selectedHomeroom}
                  onChange={e => setSelectedHomeroom(e.target.value)}
                  className="cassie-select text-sm border rounded px-3 py-1.5 focus:outline-none"
                  style={{ borderColor: '#e6e7ef', color: '#373857' }}
                >
                  <option value="">Tous (global)</option>
                  {homerooms.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {selectedHomeroom && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#fff8e1', color: '#b86e1d' }}>
                    Override pour {selectedHomeroom}
                  </span>
                )}
              </div>
            )}

            {/* UE/ECUE tree */}
            <div className="border rounded overflow-hidden" style={{ borderColor: '#e6e7ef' }}>
              {activeCourses.orderedUeCodes
                .filter(ueCode => activeCourses.ues[ueCode]?.totalCredits > 0)
                .map(ueCode => {
                  const ue = activeCourses.ues[ueCode];
                  if (!ue) return null;
                  const expanded = expandedUEs.has(ueCode);

                  // Filter ECUEs by homeroom if selected
                  const ecues = ue.ecueCodes
                    .map(ec => activeCourses.ecues[ec])
                    .filter(Boolean)
                    .filter(ec => {
                      if (!selectedHomeroom) return true;
                      return ec.homerooms.length === 0 || ec.homerooms.includes(selectedHomeroom);
                    });

                  if (ecues.length === 0 && selectedHomeroom) return null;

                  // Compute effective total credits
                  const effectiveTotal = ecues.reduce((s, ec) =>
                    s + getEffectiveCredit(ec.code, ec.credits), 0);

                  return (
                    <div key={ueCode} className="border-b last:border-b-0" style={{ borderColor: '#e6e7ef' }}>
                      {/* UE row */}
                      <button
                        onClick={() => toggleUE(ueCode)}
                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#f9f9fd] transition-colors text-left"
                      >
                        {expanded
                          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: '#c0ccda' }} />
                          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#c0ccda' }} />}
                        <span className="text-xs font-mono shrink-0" style={{ color: '#8392a5' }}>{ueCode}</span>
                        <span className="text-sm font-medium flex-1 truncate" style={{ color: '#06072d' }}>{ue.name || ueCode}</span>
                        <span className="text-sm font-bold shrink-0" style={{
                          color: effectiveTotal !== ue.totalCredits ? '#b86e1d' : '#5556fd'
                        }}>
                          {effectiveTotal} cr.
                        </span>
                      </button>

                      {/* ECUE rows */}
                      {expanded && (
                        <div className="border-t" style={{ background: '#f9f9fd', borderColor: '#e6e7ef' }}>
                          {ecues.map(ecue => {
                            const effective = getEffectiveCredit(ecue.code, ecue.credits);
                            const isOverridden = effective !== ecue.credits;
                            return (
                              <div
                                key={ecue.code}
                                className="flex items-center gap-3 px-4 py-2 pl-10 border-b last:border-b-0"
                                style={{ borderColor: '#e6e7ef' }}
                              >
                                <span className="text-xs font-mono shrink-0 w-32 truncate" style={{ color: '#8392a5' }}>{ecue.code}</span>
                                <span className="text-sm flex-1 truncate" style={{ color: '#575d78' }}>
                                  {ecue.name || ecue.code}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isOverridden && (
                                    <span className="text-xs line-through" style={{ color: '#c0ccda' }}>{ecue.credits}</span>
                                  )}
                                  <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={effective}
                                    onChange={e => handleCreditChange(ecue.code, Number(e.target.value))}
                                    className="w-16 text-sm text-center border rounded px-2 py-1 focus:outline-none"
                                    style={isOverridden
                                      ? { borderColor: '#ffc107', background: '#fff8e1', fontWeight: 700, color: '#b86e1d' }
                                      : { borderColor: '#e6e7ef', color: '#575d78' }
                                    }
                                  />
                                  <span className="text-xs" style={{ color: '#8392a5' }}>cr.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Override summary */}
            {overrides.length > 0 && (
              <div className="mt-4 p-3 rounded" style={{ background: '#fff8e1', border: '1px solid #ffc107' }}>
                <p className="text-sm font-medium" style={{ color: '#b86e1d' }}>
                  {overrides.length} modification{overrides.length > 1 ? 's' : ''} de credits en attente
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#c07a2a' }}>
                  Cliquez sur "Recalculer" pour appliquer les changements aux resultats.
                </p>
              </div>
            )}
          </div>}
        </div>
      )}
    </div>
  );
}
