import type { BilanAnnuelEntry } from '../../types/reports';
import { fmtNum } from '../../types/reports';
import ReportHeader, { ReportFooter } from './ReportHeader';

interface Props {
  entries: BilanAnnuelEntry[];
  className: string;
  anneeScolaire: string;
}

export default function BilanAnnuel({ entries, className, anneeScolaire }: Props) {
  return (
    <div className="text-[11px]" style={{ color: '#222' }}>
      <ReportHeader
        rightTitle={`Année Scolaire : ${anneeScolaire}`}
        subtitle="BILAN ANNUEL DES RÉSULTATS"
      />
      <div className="text-right text-xs font-bold mb-2">{className}</div>

      <table className="w-full border-collapse text-[9px] mt-2">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-1 py-1 text-center" rowSpan={2}>N°</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>Matricule</th>
            <th className="border px-1 py-1 text-left" rowSpan={2}>Nom et Prénoms</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>RED</th>
            <th className="border px-1 py-1 text-center" colSpan={3}>Trimestre 1</th>
            <th className="border px-1 py-1 text-center" colSpan={3}>Trimestre 2</th>
            <th className="border px-1 py-1 text-center" colSpan={3}>Trimestre 3</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>Moy. Ann.</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>Rang</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>DFA</th>
            <th className="border px-1 py-1 text-center" rowSpan={2}>Niv.Sup</th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border px-1 py-0.5 text-center">Moy</th>
            <th className="border px-1 py-0.5 text-center">Rg</th>
            <th className="border px-1 py-0.5 text-center">D/S</th>
            <th className="border px-1 py-0.5 text-center">Moy</th>
            <th className="border px-1 py-0.5 text-center">Rg</th>
            <th className="border px-1 py-0.5 text-center">D/S</th>
            <th className="border px-1 py-0.5 text-center">Moy</th>
            <th className="border px-1 py-0.5 text-center">Rg</th>
            <th className="border px-1 py-0.5 text-center">D/S</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.matricule} className="hover:bg-blue-50">
              <td className="border px-1 py-0.5 text-center">{e.numero}</td>
              <td className="border px-1 py-0.5 text-center text-[8px]">{e.matricule}</td>
              <td className="border px-1 py-0.5 whitespace-nowrap">{e.nomPrenoms}</td>
              <td className="border px-1 py-0.5 text-center">{e.redoublant ? 'R' : ''}</td>
              {/* T1 */}
              <td className="border px-1 py-0.5 text-center">{fmtNum(e.moyT1)}</td>
              <td className="border px-1 py-0.5 text-center">{e.rangT1}</td>
              <td className="border px-1 py-0.5 text-center text-[8px]">{e.dsT1}</td>
              {/* T2 */}
              <td className="border px-1 py-0.5 text-center">{fmtNum(e.moyT2)}</td>
              <td className="border px-1 py-0.5 text-center">{e.rangT2}</td>
              <td className="border px-1 py-0.5 text-center text-[8px]">{e.dsT2}</td>
              {/* T3 */}
              <td className="border px-1 py-0.5 text-center">{fmtNum(e.moyT3)}</td>
              <td className="border px-1 py-0.5 text-center">{e.rangT3}</td>
              <td className="border px-1 py-0.5 text-center text-[8px]">{e.dsT3}</td>
              {/* Annual */}
              <td className="border px-1 py-0.5 text-center font-bold">{fmtNum(e.moyAnnuelle)}</td>
              <td className="border px-1 py-0.5 text-center font-bold">{e.rangAnnuel}</td>
              <td className="border px-1 py-0.5 text-center text-[8px]">{e.dfa}</td>
              <td className="border px-1 py-0.5 text-center text-[8px]">{e.nivSup}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <p className="text-center text-gray-500 mt-8">Aucune donnée disponible.</p>
      )}

      <ReportFooter />
    </div>
  );
}
