/**
 * Step2_FileEtablissements — Upload liste_des_etablissment.xlsx.
 */
import { useState, useCallback, useRef } from 'react';
import { Upload, Building2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseEtablissementsFile } from '../../../../utils/etablissementsParser';
import { seedDRENAs, saveEtablissements, addImportLog, db } from '../../../../lib/educationDB';
import type { ImportLog } from '../../../../types/multiLevel';

interface Props {
  anneeScolaire: string;
  onNext: () => void;
  onBack: () => void;
}

interface UploadResult {
  success: boolean;
  message: string;
  details: string[];
  errors: string[];
}

export default function Step2_FileEtablissements({ anneeScolaire, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      await seedDRENAs();

      const parsed = parseEtablissementsFile(buffer);

      if (parsed.drenas.length > 0) {
        await db.drenas.bulkPut(parsed.drenas);
      }
      if (parsed.etablissements.length > 0) {
        await saveEtablissements(parsed.etablissements);
      }

      const log: ImportLog = {
        id: `imp_${Date.now()}`,
        date_import: new Date().toISOString(),
        fichier_source: file.name,
        type_import: 'etablissements',
        type_fichier: 'xlsx',
        nb_enregistrements: parsed.etablissements.length,
        statut: parsed.errors.length === 0 ? 'succes' : 'partiel',
        erreurs: parsed.errors.length > 0 ? parsed.errors : undefined,
        annee_scolaire: anneeScolaire,
      };
      await addImportLog(log);

      setResult({
        success: true,
        message: `${parsed.etablissements.length} établissements importés dans ${parsed.drenas.length} DRENA`,
        details: [
          `${parsed.drenas.length} DRENA détectés`,
          `${parsed.etablissements.length} établissements créés/mis à jour`,
          `${parsed.etablissements.reduce((s, e) => s + e.structure_classes.effectifs.total, 0)} élèves (effectifs)`,
        ],
        errors: parsed.errors,
      });
    } catch (err) {
      setResult({
        success: false,
        message: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
        details: [],
        errors: [String(err)],
      });
    } finally {
      setLoading(false);
    }
  }, [anneeScolaire]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="card-cassie p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5" style={{ color: '#5556fd' }} />
        <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
          Import des établissements
        </h3>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? '#5556fd' : '#e2e8f0',
          background: dragOver ? '#f8f8ff' : 'white',
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2" style={{ color: '#8392a5' }}>
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Analyse en cours...</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: '#c0ccda' }} />
            <p className="text-sm" style={{ color: '#06072d' }}>
              Glissez le fichier ici ou cliquez pour sélectionner
            </p>
            <p className="text-xs mt-1" style={{ color: '#8392a5' }}>
              liste_des_etablissment.xlsx (.xlsx)
            </p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg p-4" style={{
          background: result.success ? '#f0fdf4' : '#fef2f2',
          borderLeft: `3px solid ${result.success ? '#22d273' : '#ff4d4f'}`,
        }}>
          <div className="flex items-center gap-2 mb-2">
            {result.success
              ? <CheckCircle className="w-4 h-4" style={{ color: '#22d273' }} />
              : <AlertCircle className="w-4 h-4" style={{ color: '#ff4d4f' }} />}
            <span className="text-sm font-medium" style={{ color: '#06072d' }}>
              {result.message}
            </span>
          </div>
          {result.details.map((d, i) => (
            <p key={i} className="text-xs ml-6" style={{ color: '#8392a5' }}>{d}</p>
          ))}
          {result.errors.length > 0 && (
            <div className="mt-2 ml-6 text-xs" style={{ color: '#ff4d4f' }}>
              {result.errors.slice(0, 5).map((e, i) => <p key={i}>⚠ {e}</p>)}
              {result.errors.length > 5 && <p>... et {result.errors.length - 5} autres</p>}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg" style={{ color: '#8392a5' }}>
          ← Retour
        </button>
        <button
          onClick={onNext}
          disabled={!result?.success}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5556fd' }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
