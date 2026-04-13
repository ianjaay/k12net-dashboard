import { useState, useMemo, useCallback } from 'react';
import {
  Award, AlertTriangle, TrendingUp, Shield, BookOpen,
  FlaskConical, GraduationCap, Scale, Sparkles,
} from 'lucide-react';
import type { K12YearRulesConfig, GradeLevelGroup } from '../types/k12';

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  rulesConfig: K12YearRulesConfig;
  onConfigChange: (config: K12YearRulesConfig) => void;
}

// ─── Color Palette ──────────────────────────────────────────────────────────

const C = {
  th:       { fg: '#3b82f6', bg: '#dbeafe' },
  the:      { fg: '#8b5cf6', bg: '#ede9fe' },
  thf:      { fg: '#d97706', bg: '#fef3c7' },
  bti:      { fg: '#ef4444', bg: '#fee2e2' },
  avt:      { fg: '#f97316', bg: '#ffedd5' },
  bmc:      { fg: '#ef4444', bg: '#fee2e2' },
  amc:      { fg: '#f97316', bg: '#ffedd5' },
  admis:    { fg: '#16a34a', bg: '#dcfce7' },
  redouble: { fg: '#f97316', bg: '#ffedd5' },
  exclu:    { fg: '#ef4444', bg: '#fee2e2' },
  none:     { fg: '#94a3b8', bg: '#f1f5f9' },
  ok:       { fg: '#16a34a', bg: '#dcfce7' },
};

// ─── Scale Bar ──────────────────────────────────────────────────────────────

interface Zone { from: number; to: number; label: string; fg: string; bg: string }

function ScaleBar({ zones, markers }: {
  zones: Zone[];
  markers: number[];
}) {
  const max = 20;
  return (
    <div className="mt-3 mb-1 select-none">
      <div className="relative flex h-8 rounded-xl overflow-hidden" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        {zones.map((z, i) => {
          const w = ((z.to - z.from) / max) * 100;
          if (w <= 0) return null;
          return (
            <div
              key={i}
              className="flex items-center justify-center transition-all duration-300 overflow-hidden"
              style={{ width: `${w}%`, background: z.bg, borderRight: i < zones.length - 1 ? '2px solid #fff' : undefined }}
              title={`${z.label}: ${z.from} – ${z.to}`}
            >
              {w > 10 && (
                <span className="text-[10px] font-bold whitespace-nowrap px-0.5" style={{ color: z.fg }}>{z.label}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative h-4 mt-px">
        <span className="absolute left-0 text-[9px] font-medium" style={{ color: '#94a3b8' }}>0</span>
        <span className="absolute right-0 text-[9px] font-medium" style={{ color: '#94a3b8' }}>20</span>
        {markers.map((v, i) => (
          <span key={i} className="absolute text-[9px] font-bold -translate-x-1/2" style={{ left: `${(v / max) * 100}%`, color: '#475569' }}>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Stepper Input ──────────────────────────────────────────────────────────

function Stepper({ label, desc, value, onChange, color, icon, min = 0, max = 20, step = 0.5 }: {
  label: string;
  desc?: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  icon?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
}) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(1)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(1)));

  return (
    <div className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl group transition-shadow hover:shadow-sm"
         style={{ background: '#fafafe', border: '1px solid #eaecf0' }}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon && (
          <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '14', color }}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: '#334155' }}>{label}</div>
          {desc && <div className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{desc}</div>}
        </div>
      </div>
      <div className="flex items-center gap-px shrink-0">
        <button onClick={dec} disabled={value <= min}
          className="w-7 h-7 rounded-l-lg flex items-center justify-center text-sm font-bold transition hover:bg-gray-100 disabled:opacity-25"
          style={{ color: '#64748b', border: '1px solid #e2e8f0', borderRight: 'none' }}>−</button>
        <input
          type="number" value={value} step={step} min={min} max={max}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= min && v <= max) onChange(+(v.toFixed(1))); }}
          className="w-[50px] h-7 text-center text-sm font-bold border-y outline-none focus:ring-1 focus:z-10"
          style={{ color, borderColor: '#e2e8f0', background: color + '08' }}
        />
        <button onClick={inc} disabled={value >= max}
          className="w-7 h-7 rounded-r-lg flex items-center justify-center text-sm font-bold transition hover:bg-gray-100 disabled:opacity-25"
          style={{ color: '#64748b', border: '1px solid #e2e8f0', borderLeft: 'none' }}>+</button>
      </div>
    </div>
  );
}

// ─── Toggle Switch ──────────────────────────────────────────────────────────

function Toggle({ label, desc, checked, onChange, icon }: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-sm"
      style={{ border: `1.5px solid ${checked ? '#818cf833' : '#eaecf0'}`, background: checked ? '#fafaff' : '#fff' }}>
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
           style={{ background: checked ? '#5556fd14' : '#f1f5f9', color: checked ? '#5556fd' : '#94a3b8' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: '#334155' }}>{label}</div>
        <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#94a3b8' }}>{desc}</div>
      </div>
      <div className="shrink-0 mt-1">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <div className="w-10 h-[22px] rounded-full transition-colors duration-200 relative"
             style={{ background: checked ? '#5556fd' : '#cbd5e1' }}>
          <div className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
               style={{ transform: checked ? 'translateX(22px)' : 'translateX(3px)' }} />
        </div>
      </div>
    </label>
  );
}

// ─── Simulator ──────────────────────────────────────────────────────────────

function Simulator({ config }: { config: K12YearRulesConfig }) {
  const [avg, setAvg] = useState(12);
  const [group, setGroup] = useState<GradeLevelGroup>('7-10');
  const [repeating, setRepeating] = useState(false);

  const result = useMemo(() => {
    const th = config.termDistinction[group];
    let distinction = { label: 'Aucune', fg: C.none.fg, bg: C.none.bg, emoji: '—' };
    if (avg >= th.thfMin) distinction = { label: 'Félicitations', fg: C.thf.fg, bg: C.thf.bg, emoji: '🥇' };
    else if (avg >= th.theMin) distinction = { label: "Excellence", fg: C.the.fg, bg: C.the.bg, emoji: '🥈' };
    else if (avg >= th.thMin) distinction = { label: "Honneur", fg: C.th.fg, bg: C.th.bg, emoji: '🥉' };

    let sanction = { label: 'Aucune', fg: C.ok.fg, bg: C.ok.bg, emoji: '✅' };
    if (avg < config.termSanction.btiMax) sanction = { label: 'BTI', fg: C.bti.fg, bg: C.bti.bg, emoji: '🔴' };
    else if (avg < config.termSanction.avtMax) sanction = { label: 'AVT', fg: C.avt.fg, bg: C.avt.bg, emoji: '🟠' };

    const promoMin = repeating ? config.promotion.repeatingPromotionMin : config.promotion.promotionMin;
    let promotion = { label: 'ADMIS', fg: C.admis.fg, bg: C.admis.bg, emoji: '✅' };
    if (avg < config.promotion.retainedMin) promotion = { label: 'EXCLU', fg: C.exclu.fg, bg: C.exclu.bg, emoji: '❌' };
    else if (avg < promoMin) promotion = { label: 'REDOUBLE', fg: C.redouble.fg, bg: C.redouble.bg, emoji: '🔄' };

    return { distinction, sanction, promotion };
  }, [avg, group, repeating, config]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #c7d2fe', background: 'linear-gradient(135deg, #fafaff 0%, #f0f0ff 100%)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid #e0e7ff' }}>
        <FlaskConical className="w-4 h-4" style={{ color: '#5556fd' }} />
        <span className="text-[13px] font-bold" style={{ color: '#1e293b' }}>Simulateur</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#e0e7ff', color: '#4338ca' }}>Testez vos règles</span>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748b' }}>Moyenne</label>
            <div className="flex items-center gap-1">
              <input type="number" value={avg} step={0.5} min={0} max={20}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 20) setAvg(v); }}
                className="w-[72px] h-9 text-center text-lg font-bold rounded-lg outline-none focus:ring-2"
                style={{ background: '#fff', border: '1.5px solid #c7d2fe', color: '#5556fd' }} />
              <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>/20</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748b' }}>Niveau</label>
            <div className="flex h-9 rounded-lg overflow-hidden" style={{ border: '1.5px solid #c7d2fe' }}>
              {(['7-10', '11-13'] as const).map(g => (
                <button key={g} onClick={() => setGroup(g)}
                  className="px-3.5 text-xs font-semibold transition-colors"
                  style={{ background: group === g ? '#5556fd' : '#fff', color: group === g ? '#fff' : '#64748b' }}>
                  {g === '7-10' ? 'Collège' : 'Lycée'}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 h-9 px-3 rounded-lg cursor-pointer transition"
                 style={{ background: repeating ? '#fef3c7' : '#f8fafc', border: `1.5px solid ${repeating ? '#fbbf24' : '#e2e8f0'}` }}>
            <input type="checkbox" checked={repeating} onChange={e => setRepeating(e.target.checked)}
                   className="rounded" style={{ accentColor: '#f59e0b' }} />
            <span className="text-xs font-medium" style={{ color: repeating ? '#92400e' : '#64748b' }}>Redoublant</span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { title: 'Distinction', ...result.distinction },
            { title: 'Sanction', ...result.sanction },
            { title: 'Promotion', ...result.promotion },
          ].map(r => (
            <div key={r.title} className="rounded-lg p-2.5 text-center transition-colors" style={{ background: r.bg }}>
              <div className="text-lg leading-none mb-1">{r.emoji}</div>
              <div className="text-[10px] font-medium" style={{ color: '#64748b' }}>{r.title}</div>
              <div className="text-xs font-bold mt-0.5" style={{ color: r.fg }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Group Card (Collège / Lycée) ───────────────────────────────────────────

function DistinctionGroupCard({ label, emoji, group, config, onChange }: {
  label: string;
  emoji: string;
  group: GradeLevelGroup;
  config: K12YearRulesConfig;
  onChange: (group: GradeLevelGroup, field: 'thMin' | 'theMin' | 'thfMin', value: number) => void;
}) {
  const th = config.termDistinction[group];
  const zones: Zone[] = [
    { from: 0, to: th.thMin, label: 'Aucune', fg: C.none.fg, bg: C.none.bg },
    { from: th.thMin, to: th.theMin, label: 'TH', fg: C.th.fg, bg: C.th.bg },
    { from: th.theMin, to: th.thfMin, label: 'THE', fg: C.the.fg, bg: C.the.bg },
    { from: th.thfMin, to: 20, label: 'THF', fg: C.thf.fg, bg: C.thf.bg },
  ];

  return (
    <div className="p-4 rounded-xl" style={{ background: '#fff', border: '1px solid #eaecf0' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{emoji}</span>
        <span className="text-[13px] font-bold" style={{ color: '#334155' }}>{label}</span>
      </div>
      <ScaleBar zones={zones} markers={[th.thMin, th.theMin, th.thfMin]} />
      <div className="space-y-1.5 mt-3">
        <Stepper label="Tableau d'Honneur" desc={`Moy. ≥ ${th.thMin}`} value={th.thMin}
          onChange={v => onChange(group, 'thMin', v)} color={C.th.fg} icon={<Award className="w-3.5 h-3.5" />} />
        <Stepper label="Tableau d'Excellence" desc={`Moy. ≥ ${th.theMin}`} value={th.theMin}
          onChange={v => onChange(group, 'theMin', v)} color={C.the.fg} icon={<Sparkles className="w-3.5 h-3.5" />} />
        <Stepper label="Félicitations" desc={`Moy. ≥ ${th.thfMin}`} value={th.thfMin}
          onChange={v => onChange(group, 'thfMin', v)} color={C.thf.fg} icon={<GraduationCap className="w-3.5 h-3.5" />} />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CalculationRulesEditor({ rulesConfig, onConfigChange }: Props) {
  const update = useCallback((patch: Partial<K12YearRulesConfig>) => {
    onConfigChange({ ...rulesConfig, ...patch });
  }, [rulesConfig, onConfigChange]);

  const updateDistinction = useCallback((group: GradeLevelGroup, field: 'thMin' | 'theMin' | 'thfMin', value: number) => {
    update({
      termDistinction: {
        ...rulesConfig.termDistinction,
        [group]: { ...rulesConfig.termDistinction[group], [field]: value },
      },
    });
  }, [rulesConfig, update]);

  const updateSanction = useCallback((field: keyof K12YearRulesConfig['termSanction'], value: number) => {
    update({ termSanction: { ...rulesConfig.termSanction, [field]: value } });
  }, [rulesConfig, update]);

  const updatePromotion = useCallback((field: keyof K12YearRulesConfig['promotion'], value: number) => {
    update({ promotion: { ...rulesConfig.promotion, [field]: value } });
  }, [rulesConfig, update]);

  // ── Sanction scale zones ──
  const sanctionWorkZones: Zone[] = useMemo(() => [
    { from: 0, to: rulesConfig.termSanction.btiMax, label: 'BTI', fg: C.bti.fg, bg: C.bti.bg },
    { from: rulesConfig.termSanction.btiMax, to: rulesConfig.termSanction.avtMax, label: 'AVT', fg: C.avt.fg, bg: C.avt.bg },
    { from: rulesConfig.termSanction.avtMax, to: 20, label: 'OK', fg: C.ok.fg, bg: C.ok.bg },
  ], [rulesConfig.termSanction]);

  const sanctionConductZones: Zone[] = useMemo(() => [
    { from: 0, to: rulesConfig.termSanction.bmcMax, label: 'BMC', fg: C.bmc.fg, bg: C.bmc.bg },
    { from: rulesConfig.termSanction.bmcMax, to: rulesConfig.termSanction.amcMax, label: 'AMC', fg: C.amc.fg, bg: C.amc.bg },
    { from: rulesConfig.termSanction.amcMax, to: 20, label: 'OK', fg: C.ok.fg, bg: C.ok.bg },
  ], [rulesConfig.termSanction]);

  // ── Promotion scale zones ──
  const promoZones: Zone[] = useMemo(() => [
    { from: 0, to: rulesConfig.promotion.retainedMin, label: 'EXCLU', fg: C.exclu.fg, bg: C.exclu.bg },
    { from: rulesConfig.promotion.retainedMin, to: rulesConfig.promotion.promotionMin, label: 'REDOUBLE', fg: C.redouble.fg, bg: C.redouble.bg },
    { from: rulesConfig.promotion.promotionMin, to: 20, label: 'ADMIS', fg: C.admis.fg, bg: C.admis.bg },
  ], [rulesConfig.promotion]);

  return (
    <div className="space-y-6">
      {/* ── Simulator ── */}
      <Simulator config={rulesConfig} />

      {/* ── Distinctions ── */}
      <RuleSection icon={<Award className="w-4 h-4" />} title="Distinctions" subtitle="Seuils par trimestre pour chaque niveau" color="#3b82f6">
        <div className="grid sm:grid-cols-2 gap-3">
          <DistinctionGroupCard label="Collège (6ème – 3ème)" emoji="🏫" group="7-10" config={rulesConfig} onChange={updateDistinction} />
          <DistinctionGroupCard label="Lycée (2nde – Tle)" emoji="🎓" group="11-13" config={rulesConfig} onChange={updateDistinction} />
        </div>
      </RuleSection>

      {/* ── Sanctions ── */}
      <RuleSection icon={<AlertTriangle className="w-4 h-4" />} title="Sanctions" subtitle="Seuils de blâme et avertissement" color="#ef4444">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl" style={{ background: '#fff', border: '1px solid #eaecf0' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">📚</span>
              <span className="text-[13px] font-bold" style={{ color: '#334155' }}>Travail</span>
            </div>
            <ScaleBar zones={sanctionWorkZones} markers={[rulesConfig.termSanction.btiMax, rulesConfig.termSanction.avtMax]} />
            <div className="space-y-1.5 mt-3">
              <Stepper label="Blâme Travail Insuffisant" desc={`Moy. < ${rulesConfig.termSanction.btiMax}`} value={rulesConfig.termSanction.btiMax}
                onChange={v => updateSanction('btiMax', v)} color={C.bti.fg} icon={<Scale className="w-3.5 h-3.5" />} />
              <Stepper label="Avertissement Travail" desc={`Moy. < ${rulesConfig.termSanction.avtMax}`} value={rulesConfig.termSanction.avtMax}
                onChange={v => updateSanction('avtMax', v)} color={C.avt.fg} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: '#fff', border: '1px solid #eaecf0' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🤝</span>
              <span className="text-[13px] font-bold" style={{ color: '#334155' }}>Conduite</span>
            </div>
            <ScaleBar zones={sanctionConductZones} markers={[rulesConfig.termSanction.bmcMax, rulesConfig.termSanction.amcMax]} />
            <div className="space-y-1.5 mt-3">
              <Stepper label="Blâme Mauvaise Conduite" desc={`Note conduite < ${rulesConfig.termSanction.bmcMax}`} value={rulesConfig.termSanction.bmcMax}
                onChange={v => updateSanction('bmcMax', v)} color={C.bmc.fg} icon={<Shield className="w-3.5 h-3.5" />} />
              <Stepper label="Avert. Mauvaise Conduite" desc={`Note conduite < ${rulesConfig.termSanction.amcMax}`} value={rulesConfig.termSanction.amcMax}
                onChange={v => updateSanction('amcMax', v)} color={C.amc.fg} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
            </div>
          </div>
        </div>
      </RuleSection>

      {/* ── Promotion ── */}
      <RuleSection icon={<TrendingUp className="w-4 h-4" />} title="Promotion" subtitle="Seuils de fin d'année pour le passage en classe supérieure" color="#16a34a">
        <div className="p-4 rounded-xl" style={{ background: '#fff', border: '1px solid #eaecf0' }}>
          <ScaleBar zones={promoZones} markers={[rulesConfig.promotion.retainedMin, rulesConfig.promotion.promotionMin]} />
          <div className="grid sm:grid-cols-3 gap-2 mt-3">
            <Stepper label="Admis (non redoublant)" desc={`Moy. annuelle ≥ ${rulesConfig.promotion.promotionMin}`} value={rulesConfig.promotion.promotionMin}
              onChange={v => updatePromotion('promotionMin', v)} color={C.admis.fg} icon={<TrendingUp className="w-3.5 h-3.5" />} />
            <Stepper label="Redouble" desc={`Moy. annuelle ≥ ${rulesConfig.promotion.retainedMin}`} value={rulesConfig.promotion.retainedMin}
              onChange={v => updatePromotion('retainedMin', v)} color={C.redouble.fg} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
            <Stepper label="Admis (redoublant)" desc={`Redoublant: moy. ≥ ${rulesConfig.promotion.repeatingPromotionMin}`} value={rulesConfig.promotion.repeatingPromotionMin}
              onChange={v => updatePromotion('repeatingPromotionMin', v)} color={C.th.fg} icon={<Award className="w-3.5 h-3.5" />} />
          </div>
        </div>
      </RuleSection>

      {/* ── Advanced Options ── */}
      <RuleSection icon={<Shield className="w-4 h-4" />} title="Options avancées" subtitle="Règles spéciales et vérifications supplémentaires" color="#5556fd">
        <div className="space-y-2">
          <Toggle
            icon={<BookOpen className="w-4 h-4" />}
            label="Matières non-bonus pour les distinctions"
            desc="Seules les matières non-bonus sont prises en compte pour vérifier les échecs qui bloquent une distinction."
            checked={rulesConfig.useNonBonusForDistinctionCheck}
            onChange={v => update({ useNonBonusForDistinctionCheck: v })}
          />
          <Toggle
            icon={<BookOpen className="w-4 h-4" />}
            label="Vérification Français pour les distinctions"
            desc="Un échec en composition de Français empêche l'obtention d'une distinction, même si la moyenne est suffisante."
            checked={rulesConfig.checkFrenchCompositionForDistinction}
            onChange={v => update({ checkFrenchCompositionForDistinction: v })}
          />
          <Toggle
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Redoublant en terminale → exclusion automatique"
            desc="Un élève redoublant en classe terminale (3ème ou Tle) est automatiquement exclu, quelle que soit sa moyenne."
            checked={rulesConfig.terminalGradePromotion.repeatingAutoExpelled}
            onChange={v => update({ terminalGradePromotion: { ...rulesConfig.terminalGradePromotion, repeatingAutoExpelled: v } })}
          />
        </div>
      </RuleSection>

      {/* ── Formula Reference ── */}
      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #f0f0ff 0%, #f8f8ff 100%)', border: '1px solid #e0e7ff' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#5556fd14', color: '#5556fd' }}>
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-sm font-bold" style={{ color: '#1e293b' }}>Formule de calcul</h4>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Moyenne par matière', formula: 'Moyenne simple des évaluations (normalisées /20)', icon: '📊' },
            { label: 'Moyenne pondérée', formula: 'Σ(moy. matière × coefficient) / Σ(coefficients)', icon: '⚖️' },
            { label: 'Moyenne annuelle', formula: 'Moyenne des moyennes pondérées des trimestres disponibles', icon: '📅' },
            { label: 'Distinction', formula: 'Basée sur la moyenne pondérée + vérification des matières en échec', icon: '🏆' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-2.5 py-1.5">
              <span className="text-sm shrink-0">{f.icon}</span>
              <div>
                <span className="text-xs font-bold" style={{ color: '#334155' }}>{f.label}</span>
                <span className="text-xs" style={{ color: '#64748b' }}> = {f.formula}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

function RuleSection({ icon, title, subtitle, color, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '14', color }}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold" style={{ color: '#1e293b' }}>{title}</h4>
          {subtitle && <p className="text-[11px]" style={{ color: '#94a3b8' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
