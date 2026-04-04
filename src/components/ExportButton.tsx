import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import { exportTable, type ExportTableData, type ExportHeader } from '../utils/exportTable';
import { useGlobalSettings } from '../contexts/GlobalSettingsContext';

interface Props {
  getData: () => ExportTableData;
  className?: string;
  size?: 'sm' | 'md';
}

export default function ExportButton({ getData, className = '', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { settings } = useGlobalSettings();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const header: ExportHeader = {
    schoolName: settings.schoolName || 'LYCÉE SAINTE MARIE DE COCODY ABIDJAN',
    sessionTitle: '',
    sessionDate: '',
    logo: settings.logo,
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'word') => {
    setExporting(true);
    setOpen(false);
    try {
      const data = getData();
      await exportTable(data, format, header);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const btnSize = size === 'sm'
    ? 'px-2.5 py-1.5 text-[11px]'
    : 'px-3 py-2 text-xs';

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className={`inline-flex items-center gap-1.5 font-medium rounded border transition-colors hover:bg-[#f0f0ff] disabled:opacity-50 ${btnSize}`}
        style={{ borderColor: '#d4d4ff', color: '#5556fd' }}
        title="Exporter"
      >
        <Download className={iconSize} />
        {exporting ? 'Export…' : 'Exporter'}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-white border rounded shadow-lg py-1 min-w-[160px]"
          style={{ borderColor: '#e6e7ef' }}
        >
          <button
            onClick={() => handleExport('excel')}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[#f9f9fd] transition-colors text-left"
            style={{ color: '#373857' }}
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: '#22a559' }} />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[#f9f9fd] transition-colors text-left"
            style={{ color: '#373857' }}
          >
            <File className="w-4 h-4" style={{ color: '#dc3545' }} />
            PDF (.pdf)
          </button>
          <button
            onClick={() => handleExport('word')}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[#f9f9fd] transition-colors text-left"
            style={{ color: '#373857' }}
          >
            <FileText className="w-4 h-4" style={{ color: '#2b5797' }} />
            Word (.docx)
          </button>
        </div>
      )}
    </div>
  );
}
