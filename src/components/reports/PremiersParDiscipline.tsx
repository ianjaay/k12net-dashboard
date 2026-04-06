import type { PremierDisciplineEntry } from '../../types/reports';
import { fmtNum } from '../../types/reports';
import ReportHeader, { ReportFooter } from './ReportHeader';

interface Props {
  entries: PremierDisciplineEntry[];
  className: string;
  anneeScolaire: string;
  trimestre: string;
}

export default function PremiersParDiscipline({ entries, className, anneeScolaire, trimestre }: Props) {
  return (
    <div className="text-[11px]" style={{ color: '#222' }}>
      <ReportHeader
        rightTitle={`${trimestre} - Année Scolaire : ${anneeScolaire}`}
        subtitle={`LISTE DES PREMIERS PAR DISCIPLINE`}
      />
      <div className="text-right text-xs font-bold mb-2">{className}</div>

      <table className="w-full border-collapse text-[10px] mt-3">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-1 py-1 text-left">Classe</th>
            <th className="border px-1 py-1 text-left">Discipline</th>
            <th className="border px-1 py-1 text-center">Matricule</th>
            <th className="border px-1 py-1 text-left">Nom et Prénoms</th>
            <th className="border px-1 py-1 text-center">Sexe</th>
            <th className="border px-1 py-1 text-center">Moyenne</th>
            <th className="border px-1 py-1 text-center">Observation</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.discipline}-${i}`} className="hover:bg-blue-50">
              <td className="border px-1 py-1">{i === 0 ? e.classe : ''}</td>
              <td className="border px-1 py-1">{e.discipline}</td>
              <td className="border px-1 py-1 text-center text-[9px]">{e.matricule}</td>
              <td className="border px-1 py-1">{e.nomPrenoms}</td>
              <td className="border px-1 py-1 text-center">{e.sexe}</td>
              <td className="border px-1 py-1 text-center font-medium">{fmtNum(e.moyenne)}</td>
              <td className="border px-1 py-1 text-center">{e.observation}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReportFooter />
    </div>
  );
}
