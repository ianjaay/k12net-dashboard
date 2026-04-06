import type { NonClasseEntry } from '../../types/reports';
import ReportHeader, { ReportFooter } from './ReportHeader';

interface NiveauGroup {
  niveau: string;
  eleves: NonClasseEntry[];
}

interface Props {
  groups: NiveauGroup[];
  anneeScolaire: string;
  trimestre: string;
}

export default function NonClasses({ groups, anneeScolaire, trimestre }: Props) {
  const totalCount = groups.reduce((s, g) => s + g.eleves.length, 0);

  return (
    <div className="text-[11px]" style={{ color: '#222' }}>
      <ReportHeader
        rightTitle={`${trimestre} - Année Scolaire : ${anneeScolaire}`}
        subtitle="LISTE DES ÉLÈVES NON-CLASSÉS"
      />

      {groups.map(({ niveau, eleves }) => (
        <div key={niveau} className="mb-6">
          <h3 className="font-bold text-xs mb-1">{niveau}</h3>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-1 py-1 text-center w-8">N°</th>
                <th className="border px-1 py-1 text-center">Matricule</th>
                <th className="border px-1 py-1 text-left">Nom et Prénoms</th>
                <th className="border px-1 py-1 text-center">Sexe</th>
                <th className="border px-1 py-1 text-left">Classe</th>
                <th className="border px-1 py-1 text-center">RED</th>
              </tr>
            </thead>
            <tbody>
              {eleves.map((e) => (
                <tr key={e.matricule} className="hover:bg-blue-50">
                  <td className="border px-1 py-1 text-center">{e.numero}</td>
                  <td className="border px-1 py-1 text-center text-[9px]">{e.matricule}</td>
                  <td className="border px-1 py-1">{e.nomPrenoms}</td>
                  <td className="border px-1 py-1 text-center">{e.sexe}</td>
                  <td className="border px-1 py-1">{e.classe}</td>
                  <td className="border px-1 py-1 text-center">{e.redoublant ? 'R' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9px] mt-1 text-gray-600">
            Total : {eleves.length} élève{eleves.length > 1 ? 's' : ''}
          </p>
        </div>
      ))}

      {totalCount === 0 && (
        <p className="text-center text-gray-500 mt-8">Aucun élève non-classé.</p>
      )}

      <ReportFooter />
    </div>
  );
}
