import type { MajorEntry } from '../../types/reports';
import { fmtNum } from '../../types/reports';
import ReportHeader, { ReportFooter } from './ReportHeader';

interface Props {
  entries: MajorEntry[];
  anneeScolaire: string;
  trimestre: string;
  mode: 'classe' | 'niveau';
}

export default function MajorsReport({ entries, anneeScolaire, trimestre, mode }: Props) {
  const title = mode === 'classe' ? 'LISTE DES MAJORS PAR CLASSE' : 'LISTE DES MAJORS PAR NIVEAU';
  const lastCol = mode === 'classe' ? 'Classe' : 'Niveau';

  return (
    <div className="text-[11px]" style={{ color: '#222' }}>
      <ReportHeader
        rightTitle={`${trimestre} - Année Scolaire : ${anneeScolaire}`}
        subtitle={title}
      />

      <table className="w-full border-collapse text-[10px] mt-3">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-1 py-1 text-center">N°</th>
            <th className="border px-1 py-1 text-center">Matricule</th>
            <th className="border px-1 py-1 text-left">Nom et Prénoms</th>
            <th className="border px-1 py-1 text-center">Sexe</th>
            <th className="border px-1 py-1 text-center">Date Naiss.</th>
            <th className="border px-1 py-1 text-center">Nat</th>
            <th className="border px-1 py-1 text-center">Red</th>
            <th className="border px-1 py-1 text-center">LV2</th>
            <th className="border px-1 py-1 text-center">Moy.</th>
            <th className="border px-1 py-1 text-center">{lastCol}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.matricule} className="hover:bg-blue-50">
              <td className="border px-1 py-1 text-center">{e.numero}</td>
              <td className="border px-1 py-1 text-center text-[9px]">{e.matricule}</td>
              <td className="border px-1 py-1">{e.nomPrenoms}</td>
              <td className="border px-1 py-1 text-center">{e.sexe}</td>
              <td className="border px-1 py-1 text-center">{e.dateNaissance}</td>
              <td className="border px-1 py-1 text-center">{e.nationalite}</td>
              <td className="border px-1 py-1 text-center">{e.redoublant ? 'Oui' : ''}</td>
              <td className="border px-1 py-1 text-center">{e.lv2}</td>
              <td className="border px-1 py-1 text-center font-medium">{fmtNum(e.moyenne)}</td>
              <td className="border px-1 py-1 text-center">{mode === 'classe' ? e.classe : e.niveau}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReportFooter />
    </div>
  );
}
