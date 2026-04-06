import { useState, useMemo, useRef } from 'react';
import { FileText, Printer, Download } from 'lucide-react';
import { useSession } from '../../contexts/SessionContext';
import type { TermId } from '../../types/k12';
import type { ReportType } from '../../types/reports';
import { REPORT_CATALOG, getTrimestreLabel } from '../../types/reports';
import {
  computePVConseil,
  computeListeNominative,
  computeMajorsParClasse,
  computeMajorsParNiveau,
  computePremiersParDiscipline,
  computeNonClasses,
  computeBilanAnnuel,
} from '../../utils/reportCalculations';
import PVConseilClasse from './PVConseilClasse';
import ListeNominative from './ListeNominative';
import MajorsReport from './MajorsReport';
import PremiersParDiscipline from './PremiersParDiscipline';
import NonClasses from './NonClasses';
import BilanAnnuel from './BilanAnnuel';

// Reports that need a specific class selected
const CLASS_REPORTS: ReportType[] = [
  'pv_conseil_classe', 'liste_nominative', 'premiers_par_discipline', 'bilan_annuel',
];

export default function ReportsTab() {
  const {
    filteredClasses, selectedClassId, classes,
    appData,
  } = useSession();

  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [termId, setTermId] = useState<TermId>('T1');
  const printRef = useRef<HTMLDivElement>(null);

  const anneeScolaire = appData?.academicYear
    ? `${appData.academicYear}-${parseInt(appData.academicYear) + 1}`
    : '2024-2025';

  const selectedClass = useMemo(
    () => classes.find(c => c.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const needsClass = selectedReport ? CLASS_REPORTS.includes(selectedReport) : false;
  const canRender = selectedReport && (!needsClass || selectedClass);

  // Render the selected report
  const reportContent = useMemo(() => {
    if (!canRender || !selectedReport) return null;

    const triLabel = getTrimestreLabel(termId);

    switch (selectedReport) {
      case 'pv_conseil_classe': {
        if (!selectedClass) return null;
        const data = computePVConseil(selectedClass, termId, anneeScolaire);
        return <PVConseilClasse data={data} anneeScolaire={anneeScolaire} />;
      }
      case 'liste_nominative': {
        if (!selectedClass) return null;
        const data = computeListeNominative(selectedClass, termId, anneeScolaire);
        return <ListeNominative data={data} anneeScolaire={anneeScolaire} />;
      }
      case 'majors_par_classe': {
        const entries = computeMajorsParClasse(filteredClasses, termId);
        return <MajorsReport entries={entries} anneeScolaire={anneeScolaire} trimestre={triLabel} mode="classe" />;
      }
      case 'majors_par_niveau': {
        const entries = computeMajorsParNiveau(filteredClasses, termId);
        return <MajorsReport entries={entries} anneeScolaire={anneeScolaire} trimestre={triLabel} mode="niveau" />;
      }
      case 'premiers_par_discipline': {
        if (!selectedClass) return null;
        const entries = computePremiersParDiscipline(selectedClass, termId);
        return (
          <PremiersParDiscipline
            entries={entries}
            className={selectedClass.displayName || selectedClass.name}
            anneeScolaire={anneeScolaire}
            trimestre={triLabel}
          />
        );
      }
      case 'non_classes': {
        const groups = computeNonClasses(filteredClasses, termId);
        return <NonClasses groups={groups} anneeScolaire={anneeScolaire} trimestre={triLabel} />;
      }
      case 'bilan_annuel': {
        if (!selectedClass) return null;
        const entries = computeBilanAnnuel(selectedClass);
        return (
          <BilanAnnuel
            entries={entries}
            className={selectedClass.displayName || selectedClass.name}
            anneeScolaire={anneeScolaire}
          />
        );
      }
      default:
        return null;
    }
  }, [selectedReport, termId, selectedClass, filteredClasses, anneeScolaire, canRender]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #222; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #999; padding: 2px 4px; font-size: 9pt; }
          th { background: #f5f5f5; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Term selector */}
        <select
          value={termId}
          onChange={e => setTermId(e.target.value as TermId)}
          className="text-sm border rounded-lg px-3 py-2"
          style={{ borderColor: '#e2e8f0' }}
        >
          <option value="T1">Trimestre 1</option>
          <option value="T2">Trimestre 2</option>
          <option value="T3">Trimestre 3</option>
        </select>

        {/* Print / Export buttons */}
        {canRender && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border hover:bg-gray-50"
              style={{ borderColor: '#e2e8f0' }}
            >
              <Printer className="w-4 h-4" /> Imprimer
            </button>
          </div>
        )}
      </div>

      {/* ── Report selector grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {REPORT_CATALOG.map(meta => {
          const isActive = selectedReport === meta.id;
          const disabled = CLASS_REPORTS.includes(meta.id) && !selectedClass;
          return (
            <button
              key={meta.id}
              onClick={() => !disabled && setSelectedReport(meta.id)}
              disabled={disabled}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                isActive
                  ? 'border-[#5556fd] bg-[#5556fd]/5'
                  : disabled
                  ? 'border-gray-200 opacity-40 cursor-not-allowed'
                  : 'border-gray-200 hover:border-[#5556fd]/40 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className={`w-4 h-4 ${isActive ? 'text-[#5556fd]' : 'text-gray-400'}`} />
                <span className={`text-xs font-semibold ${isActive ? 'text-[#5556fd]' : 'text-gray-700'}`}>
                  {meta.label}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 line-clamp-2">{meta.description}</p>
              {disabled && (
                <p className="text-[9px] text-orange-500 mt-1">Sélectionnez une classe</p>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Warning if class needed ── */}
      {selectedReport && needsClass && !selectedClass && (
        <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3">
          Ce rapport nécessite la sélection d'une classe dans le filtre de la barre latérale.
        </div>
      )}

      {/* ── Report preview ── */}
      {canRender && (
        <div
          ref={printRef}
          className="bg-white border rounded-xl p-6 shadow-sm overflow-x-auto"
          style={{ borderColor: '#e2e8f0' }}
        >
          {reportContent}
        </div>
      )}

      {/* ── Empty state ── */}
      {!selectedReport && (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sélectionnez un rapport ci-dessus pour le prévisualiser</p>
        </div>
      )}
    </div>
  );
}
