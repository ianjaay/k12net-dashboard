import type { ListeNominativeData } from '../../types/reports';
import { fmtNum } from '../../types/reports';
import ReportHeader, { ReportFooter } from './ReportHeader';

interface Props {
  data: ListeNominativeData;
  anneeScolaire: string;
}

export default function ListeNominative({ data, anneeScolaire }: Props) {
  const d = data;

  return (
    <div className="text-[11px]" style={{ color: '#222' }}>
      <ReportHeader
        rightTitle={`${d.trimestre} - Année Scolaire : ${anneeScolaire}`}
        subtitle={`LISTE NOMINATIVE PAR ORDRE ALPHABETIQUE`}
      />
      <div className="text-right text-xs font-bold mb-2">{d.displayName}</div>

      <p className="text-xs mb-3">
        <strong>Effectif : {d.effectifs.total}</strong>&nbsp;&nbsp;
        Garçons: {d.effectifs.garcons}&nbsp;&nbsp;
        Filles: {d.effectifs.filles}
      </p>

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-1 py-1 text-center" rowSpan={2}>N°</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>MATRICULE</th>
            <th className="border px-1 py-1 text-left" rowSpan={2}>NOM ET PRÉNOMS</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>NAT</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>SEXE</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>AFF</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>RED</th>
            <th className="border px-1 py-1 text-center" colSpan={3}>{d.trimestre}</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>OBSERV.</th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border px-1 py-0.5 text-center">MOYENNE</th>
            <th className="border px-1 py-0.5 text-center">RANG</th>
            <th className="border px-1 py-0.5 text-center">DIST./SANCT.</th>
          </tr>
        </thead>
        <tbody>
          {d.eleves.map(e => (
            <tr key={e.matricule} className="hover:bg-blue-50">
              <td className="border px-1 py-0.5 text-center">{e.numero}</td>
              <td className="border px-1 py-0.5 text-center text-[9px]">{e.matricule}</td>
              <td className="border px-1 py-0.5">{e.nomPrenoms}</td>
              <td className="border px-1 py-0.5 text-center">{e.nationalite}</td>
              <td className="border px-1 py-0.5 text-center">{e.sexe}</td>
              <td className="border px-1 py-0.5 text-center">{e.affecte ? 'Oui' : ''}</td>
              <td className="border px-1 py-0.5 text-center">{e.redoublant ? 'Oui' : ''}</td>
              <td className="border px-1 py-0.5 text-center font-medium">{fmtNum(e.moyenne)}</td>
              <td className="border px-1 py-0.5 text-center">{e.rang}</td>
              <td className="border px-1 py-0.5 text-center font-medium">{e.distinctionSanction}</td>
              <td className="border px-1 py-0.5 text-center">{e.observation}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReportFooter />
    </div>
  );
}
