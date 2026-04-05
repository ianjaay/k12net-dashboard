/**
 * Step3_FileEleves — Select establishment + upload listes_eleves.xlsx.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseElevesFile } from '../../../../utils/elevesParser';
import {
  getAllEtablissements, saveClasses, saveEleves, addImportLog, ensureDefaultYear,
} from '../../../../lib/educationDB';
import type { Etablissement, ImportLog } from '../../../../types/multiLevel';

interface Props {
  anneeScolaire: string;
  onDone: () => void;
  onBack: () => void;
}

interface UploadResult {
  success: boolean;
  message: string;
  details: string[];
  errors: string[];
}

export default function Step3_FileEleves({ anneeScolaire, onDone, onBack }: Props) {
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [selectedEtabId, setSelectedEtabId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllEtablissements().then(etabs => {
      setEtablissements(etabs);
      if (etabs.length === 1) setSelectedEtabId(etabs[0].id);
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!selectedEtabId) {
      setResult({ success: false, message: 'Sélectionnez un établissement', details: [], errors: [] });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      await ensureDefaultYear(anneeScolaire);

      const parsed = parseElevesFile(buffer, selectedEtabId, anneeScolaire);

      if (parsed.classes.length > 0) await saveClasses(parsed.classes);
      if (parsed.eleves.length > 0) await saveEleves(parsed.eleves);

      const log: ImportLog = {
        id: `imp_${Date.now()}`,
        date_import: new Date().toISOString(),
        fichier_source: file.name,
        type_import: 'eleves',
        type_fichier: 'xlsx',
        nb_enregistrements: parsed.eleves.length,
        statut: parsed.errors.length === 0 ? 'succes' : 'partiel',
        erreurs: parsed.errors.length > 0 ? parsed.errors : undefined,
        etablissement_id: selectedEtabId,
        annee_scolaire: anneeScolaire,
      };
      await addImportLog(log);

      const classCounts = new Map<string, number>();
      for (const e of parsed.eleves) {
        classCounts.set(e.salle_de_classe, (classCounts.get(e.salle_de_classe) ?? 0) + 1);
      }

      setResult({
        success: true,
        message: `${parsed.eleves.length} élèves importés dans ${parsed.classes.length} classes`,
        details: [
          `${parsed.classes.length} classes créées automatiquement`,
          ...Array.from(classCounts.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cls, count]) => `${cls}: ${count} élèves`),
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
  }, [selectedEtabId, anneeScolaire]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="card-cassie p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" style={{ color: '#22d273' }} />
        <h3 className="font-bold text-sm" style={{ color: '#06072d' }}>
          Import des élèves
        </h3>
      </div>

      {/* Établissement selector */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            Établissement
          </label>
          <select
            value={selectedEtabId}
            onChange={e => setSelectedEtabId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: '#e2e8f0' }}
          >
            <option value="">— Sélectionnez —</option>
            {etablissements.map(e => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#06072d' }}>
            Année scolaire
          </label>
          <input
            type="text"
            value={`${anneeScolaire}-${parseInt(anneeScolaire, 10) + 1}`}
            disabled
            className="w-full px-3 py-2 text-sm rounded-lg border bg-gray-50"
            style={{ borderColor: '#e2e8f0' }}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? '#22d273' : '#e2e8f0',
          background: dragOver ? '#f0fdf4' : 'white',
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
              listes_eleves.xlsx (.xlsx)
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
          onClick={onDone}
          disabled={!result?.success}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#22d273' }}
        >
          Terminer
        </button>
      </div>
    </div>
  );
}
