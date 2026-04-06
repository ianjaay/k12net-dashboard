/**
 * ImportWizard — Dual-mode import: Excel (3 steps) or API OneRoster (4 steps).
 */
import { useState, useCallback } from 'react';
import { FileSpreadsheet, Globe, ChevronRight, ArrowLeft } from 'lucide-react';
import type { ImportMode, OneRosterApiConfig, OrgSelectionTree } from '../../types/oneRoster';
import { OneRosterService } from '../../lib/oneRosterService';
import type { SelectedYear } from './steps/api/Step3_SessionSelection';

import Step1_AnneeSelection from './steps/excel/Step1_AnneeSelection';
import Step2_FileEtablissements from './steps/excel/Step2_FileEtablissements';
import Step3_FileEleves from './steps/excel/Step3_FileEleves';
import Step1_ApiConfig from './steps/api/Step1_ApiConfig';
import Step2_OrgSelection from './steps/api/Step2_OrgSelection';
import Step3_SessionSelection from './steps/api/Step3_SessionSelection';
import Step4_ImportLaunch from './steps/api/Step4_ImportLaunch';

export default function ImportWizard() {
  const [mode, setMode] = useState<ImportMode | null>(null);
  const [step, setStep] = useState(1);

  // Excel state
  const [excelAnneeScolaire, setExcelAnneeScolaire] = useState('2025');

  // API state
  const [apiConfig, setApiConfig] = useState<OneRosterApiConfig | null>(null);
  const [service, setService] = useState<OneRosterService | null>(null);
  const [orgTree, setOrgTree] = useState<OrgSelectionTree | null>(null);
  const [selectedYears, setSelectedYears] = useState<SelectedYear[]>([]);

  const totalSteps = mode === 'api' ? 4 : 3;

  const handleBack = useCallback(() => {
    if (step === 1) setMode(null);
    else setStep(s => s - 1);
  }, [step]);

  const handleReset = useCallback(() => {
    setMode(null);
    setStep(1);
    setApiConfig(null);
    setService(null);
    setOrgTree(null);
    setSelectedYears([]);
  }, []);

  // ─── Mode selector ────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#06072d' }}>
            Chargement des données
          </h2>
          <p className="text-sm mt-1" style={{ color: '#8392a5' }}>
            Choisissez le mode de chargement des données
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => { setMode('excel'); setStep(1); }}
            className="card-cassie p-6 text-left transition-all hover:shadow-md border-2"
            style={{ borderColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#5556fd')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <FileSpreadsheet className="w-8 h-8 mb-3" style={{ color: '#5556fd' }} />
            <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
              Mode 1 — Import Excel
            </h3>
            <p className="text-xs mt-2" style={{ color: '#8392a5' }}>
              Importez les données depuis les fichiers Excel<br />
              (liste_des_etablissment.xlsx + listes_eleves.xlsx)
            </p>
            <p className="text-[10px] mt-3 px-2 py-1 rounded inline-block"
              style={{ background: '#f0f0ff', color: '#5556fd' }}>
              3 étapes · Import manuel
            </p>
          </button>
          <button
            onClick={() => { setMode('api'); setStep(1); }}
            className="card-cassie p-6 text-left transition-all hover:shadow-md border-2"
            style={{ borderColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#22d273')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <Globe className="w-8 h-8 mb-3" style={{ color: '#22d273' }} />
            <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
              Mode 2 — Web Service API
            </h3>
            <p className="text-xs mt-2" style={{ color: '#8392a5' }}>
              Synchronisez les données via l'API OneRoster v1.1<br />
              (connexion directe au système K12net)
            </p>
            <p className="text-[10px] mt-3 px-2 py-1 rounded inline-block"
              style={{ background: '#e6f9ef', color: '#1a8a4d' }}>
              4 étapes · Automatique
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ─── Wizard with steps ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#06072d' }}>
          {mode === 'excel' ? 'Import via fichier Excel' : 'Import via Web Service'}
        </h2>
        <p className="text-sm mt-1" style={{ color: '#8392a5' }}>
          {mode === 'excel'
            ? 'Importez les données depuis les fichiers Excel du système K12net'
            : "Synchronisez les données via l'API OneRoster v1.1"}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: step >= s ? '#5556fd' : '#f3f6f9',
                color: step >= s ? 'white' : '#8392a5',
              }}
            >
              {s}
            </div>
            {s < totalSteps && <ChevronRight className="w-4 h-4" style={{ color: '#c0ccda' }} />}
          </div>
        ))}
        <span className="ml-3 text-xs" style={{ color: '#8392a5' }}>
          Étape {step}/{totalSteps}
        </span>
      </div>

      {/* Excel steps */}
      {mode === 'excel' && step === 1 && (
        <Step1_AnneeSelection
          value={excelAnneeScolaire}
          onChange={setExcelAnneeScolaire}
          onNext={() => setStep(2)}
        />
      )}
      {mode === 'excel' && step === 2 && (
        <Step2_FileEtablissements
          anneeScolaire={excelAnneeScolaire}
          onNext={() => setStep(3)}
          onBack={handleBack}
        />
      )}
      {mode === 'excel' && step === 3 && (
        <Step3_FileEleves
          anneeScolaire={excelAnneeScolaire}
          onDone={handleReset}
          onBack={handleBack}
        />
      )}

      {/* API steps */}
      {mode === 'api' && step === 1 && (
        <Step1_ApiConfig
          onNext={(config) => {
            setApiConfig(config);
            setService(new OneRosterService(config));
            setStep(2);
          }}
        />
      )}
      {mode === 'api' && step === 2 && service && (
        <Step2_OrgSelection
          service={service}
          onNext={(tree) => { setOrgTree(tree); setStep(3); }}
          onBack={handleBack}
        />
      )}
      {mode === 'api' && step === 3 && service && (
        <Step3_SessionSelection
          service={service}
          onNext={(years) => { setSelectedYears(years); setStep(4); }}
          onBack={handleBack}
        />
      )}
      {mode === 'api' && step === 4 && service && orgTree && apiConfig && (
        <Step4_ImportLaunch
          service={service}
          orgTree={orgTree}
          selectedYears={selectedYears}
          apiConfig={apiConfig}
          onDone={handleReset}
          onBack={handleBack}
        />
      )}

      {/* Back to mode selector */}
      {step === 1 && (
        <button
          onClick={() => setMode(null)}
          className="flex items-center gap-1 text-xs mt-2"
          style={{ color: '#8392a5' }}
        >
          <ArrowLeft className="w-3 h-3" /> Retour au choix du mode
        </button>
      )}
    </div>
  );
}
