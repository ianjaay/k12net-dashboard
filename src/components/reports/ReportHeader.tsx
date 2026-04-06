import type { Etablissement } from '../../types/reports';
import { DEFAULT_ETABLISSEMENT } from '../../types/reports';

interface Props {
  etablissement?: Partial<Etablissement>;
  rightTitle?: string;
  subtitle?: string;
}

export default function ReportHeader({ etablissement, rightTitle, subtitle }: Props) {
  const e = { ...DEFAULT_ETABLISSEMENT, ...etablissement };

  return (
    <div className="report-header mb-4">
      <div className="flex justify-between items-start mb-3">
        {/* Left side: Republic info */}
        <div className="text-[10px] leading-tight" style={{ color: '#333' }}>
          <p className="font-bold">{e.pays}</p>
          <p>{e.ministere}</p>
          <p>{e.direction}</p>
        </div>
        {/* Right side: School info */}
        <div className="text-[10px] leading-tight text-right" style={{ color: '#333' }}>
          <p className="font-bold">{e.nom}</p>
          <p>Code: {e.code}</p>
          <p>Statut: {e.statut}</p>
        </div>
      </div>
      {rightTitle && (
        <div className="text-right text-xs font-semibold mb-2" style={{ color: '#06072d' }}>
          {rightTitle}
        </div>
      )}
      {subtitle && (
        <div className="border border-gray-300 px-3 py-1.5 inline-block text-xs font-bold mb-2" style={{ color: '#06072d' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function ReportFooter({ etablissement }: { etablissement?: Partial<Etablissement> }) {
  const e = { ...DEFAULT_ETABLISSEMENT, ...etablissement };
  const now = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="report-footer mt-6 pt-3 border-t text-[9px]" style={{ borderColor: '#ccc', color: '#666' }}>
      <div className="flex justify-between">
        <div>
          <p className="font-semibold">{e.nom}</p>
          <p>Adresse: {e.adresse}</p>
          <p>Téléphone: {e.telephone}</p>
          <p>E-mail: {e.email}</p>
        </div>
        <div className="text-right">
          <p>Imprimé le {now}</p>
        </div>
      </div>
    </div>
  );
}
