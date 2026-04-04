import { useMemo } from 'react';
import type { PVConseilData } from '../../types/reports';
import { fmtNum } from '../../types/reports';
import ReportHeader, { ReportFooter } from './ReportHeader';

interface Props {
  data: PVConseilData;
  anneeScolaire: string;
}

export default function PVConseilClasse({ data, anneeScolaire }: Props) {
  const d = data;

  return (
    <div className="space-y-6 text-[11px]" style={{ color: '#222' }}>
      {/* ── Page 1: Vue d'ensemble ── */}
      <div className="report-page">
        <ReportHeader
          subtitle={`P.V PROVISOIRE DE CONSEIL DE CLASSE: ${d.classe}`}
          rightTitle={`${d.trimestre} ${anneeScolaire}`}
        />

        {/* PP + Educateur */}
        <div className="flex justify-between text-xs mb-4">
          <p><span className="font-semibold">Professeur Principal :</span> {d.professeurPrincipal || '—'}</p>
          <p><span className="font-semibold">Educateur :</span> {d.educateur || '—'}</p>
        </div>

        {/* Effectifs + Répartition side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Effectifs */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1">Effectifs Généraux</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-2 py-1 text-left"></th>
                  <th className="border px-2 py-1 text-center">GARÇONS</th>
                  <th className="border px-2 py-1 text-center">FILLES</th>
                  <th className="border px-2 py-1 text-center">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1 font-medium">EFFECTIF TOTAL</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.garcons}</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.filles}</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.total}</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 font-medium">NBRE ELEVES CLASSES</td>
                  <td className="border px-2 py-1 text-center">0</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.classes}</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.classes}</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 font-medium">NBRES ELEVES ABSENTS</td>
                  <td className="border px-2 py-1 text-center">0</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.absents}</td>
                  <td className="border px-2 py-1 text-center">{d.effectifs.absents}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Répartition des moyennes */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1">Répartition des Moyennes</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-1 py-1"></th>
                  <th className="border px-1 py-1 text-center" colSpan={2}>Moy{'<'}8,5</th>
                  <th className="border px-1 py-1 text-center" colSpan={2}>8,5{'≤'}Moy{'<'}10</th>
                  <th className="border px-1 py-1 text-center" colSpan={2}>Moy{'≥'}10</th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border px-1 py-1">Genre</th>
                  <th className="border px-1 py-1 text-center">Nb</th>
                  <th className="border px-1 py-1 text-center">%</th>
                  <th className="border px-1 py-1 text-center">Nb</th>
                  <th className="border px-1 py-1 text-center">%</th>
                  <th className="border px-1 py-1 text-center">Nb</th>
                  <th className="border px-1 py-1 text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {d.repartitionMoyennes.map(r => (
                  <tr key={r.genre}>
                    <td className="border px-1 py-1 font-medium">{r.genre}</td>
                    <td className="border px-1 py-1 text-center">{r.inf_8_5.nombre}</td>
                    <td className="border px-1 py-1 text-center">{fmtNum(r.inf_8_5.pourcentage)}</td>
                    <td className="border px-1 py-1 text-center">{r.entre_8_5_10.nombre}</td>
                    <td className="border px-1 py-1 text-center">{fmtNum(r.entre_8_5_10.pourcentage)}</td>
                    <td className="border px-1 py-1 text-center">{r.sup_10.nombre}</td>
                    <td className="border px-1 py-1 text-center">{fmtNum(r.sup_10.pourcentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Moyenne summary */}
        <div className="flex gap-6 text-xs mb-4 p-2 bg-gray-50 rounded">
          <span>Moyenne de la Classe : <strong>{fmtNum(d.moyenneClasse)}</strong></span>
          <span>Plus faible moyenne : <strong>{fmtNum(d.plusFaibleMoyenne)}</strong></span>
          <span>Plus forte moyenne : <strong>{fmtNum(d.plusForteMoyenne)}</strong></span>
        </div>

        {/* Distinctions + Sanctions side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1">Distinctions</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead><tr className="bg-gray-50"><th className="border px-2 py-1 text-left">Libellé</th><th className="border px-2 py-1 text-center">Nombre</th></tr></thead>
              <tbody>
                <tr><td className="border px-2 py-1">TABLEAU D'HONNEUR</td><td className="border px-2 py-1 text-center">{d.distinctions.tableauHonneur}</td></tr>
                <tr><td className="border px-2 py-1">TABLEAU D'HONNEUR+ ENCOURAGEMENTS</td><td className="border px-2 py-1 text-center">{d.distinctions.tableauHonneurEncouragements}</td></tr>
                <tr><td className="border px-2 py-1">TABLEAU D'HONNEUR+ FÉLICITATIONS</td><td className="border px-2 py-1 text-center">{d.distinctions.tableauHonneurFelicitations}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1">Sanctions</h4>
            <table className="w-full border-collapse text-[10px]">
              <thead><tr className="bg-gray-50"><th className="border px-2 py-1 text-left">Libellé</th><th className="border px-2 py-1 text-center">Nombre</th></tr></thead>
              <tbody>
                <tr><td className="border px-2 py-1">BLÂME TRAVAIL</td><td className="border px-2 py-1 text-center">{d.sanctions.blameTravail}</td></tr>
                <tr><td className="border px-2 py-1">AVERTISSEMENT TRAVAIL</td><td className="border px-2 py-1 text-center">{d.sanctions.avertissementTravail}</td></tr>
                <tr><td className="border px-2 py-1">BLÂME CONDUITE</td><td className="border px-2 py-1 text-center">{d.sanctions.blameConduite}</td></tr>
                <tr><td className="border px-2 py-1">AVERTISSEMENT CONDUITE</td><td className="border px-2 py-1 text-center">{d.sanctions.avertissementConduite}</td></tr>
                <tr><td className="border px-2 py-1">TABLEAU D'HONNEUR REFUSÉ</td><td className="border px-2 py-1 text-center">{d.sanctions.tableauHonneurRefuse}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <ReportFooter />
      </div>

      {/* ── Page 2: Statistiques par discipline ── */}
      <div className="report-page border-t pt-6">
        <ReportHeader
          subtitle={`P.V PROVISOIRE DE CONSEIL DE CLASSE: ${d.classe}`}
          rightTitle={`${d.trimestre} ${anneeScolaire}`}
        />
        <h4 className="text-[10px] font-bold uppercase tracking-wide mb-2">Statistiques par Discipline</h4>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-1 py-1 text-left">Discipline</th>
              <th className="border px-1 py-1 text-center">Ef.Classés</th>
              <th className="border px-1 py-1 text-center">M.Classe</th>
              <th className="border px-1 py-1 text-left">Enseignant(s)</th>
              <th className="border px-1 py-1 text-center" colSpan={2}>Moy {'<'} 8,5</th>
              <th className="border px-1 py-1 text-center" colSpan={2}>8,5 {'≤'} Moy {'<'} 10</th>
              <th className="border px-1 py-1 text-center" colSpan={2}>Moy{'≥'}10</th>
              <th className="border px-1 py-1 text-center">Emargement</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border px-1 py-0.5"></th><th className="border px-1 py-0.5"></th>
              <th className="border px-1 py-0.5"></th><th className="border px-1 py-0.5"></th>
              <th className="border px-1 py-0.5 text-center text-[9px]">Nb</th>
              <th className="border px-1 py-0.5 text-center text-[9px]">%</th>
              <th className="border px-1 py-0.5 text-center text-[9px]">Nb</th>
              <th className="border px-1 py-0.5 text-center text-[9px]">%</th>
              <th className="border px-1 py-0.5 text-center text-[9px]">Nb</th>
              <th className="border px-1 py-0.5 text-center text-[9px]">%</th>
              <th className="border px-1 py-0.5"></th>
            </tr>
          </thead>
          <tbody>
            {d.disciplines.map(disc => (
              <tr key={disc.nom}>
                <td className="border px-1 py-1">{disc.nom}</td>
                <td className="border px-1 py-1 text-center">{disc.effectifClasses}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.moyenneClasse)}</td>
                <td className="border px-1 py-1 text-[9px]">{disc.enseignant}</td>
                <td className="border px-1 py-1 text-center">{disc.repartition.inf_8_5.nombre}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.repartition.inf_8_5.pourcentage)}</td>
                <td className="border px-1 py-1 text-center">{disc.repartition.entre_8_5_10.nombre}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.repartition.entre_8_5_10.pourcentage)}</td>
                <td className="border px-1 py-1 text-center">{disc.repartition.sup_10.nombre}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.repartition.sup_10.pourcentage)}</td>
                <td className="border px-1 py-1"></td>
              </tr>
            ))}
          </tbody>
        </table>
        <ReportFooter />
      </div>

      {/* ── Page 3: Stats généraux + signatures ── */}
      <div className="report-page border-t pt-6">
        <ReportHeader
          subtitle={`P.V PROVISOIRE DE CONSEIL DE CLASSE: ${d.classe}`}
          rightTitle={`${d.trimestre} ${anneeScolaire}`}
        />
        <h4 className="text-[10px] font-bold uppercase tracking-wide mb-2">Statistiques Généraux par Discipline</h4>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-1 py-1 text-left">Matricule</th>
              <th className="border px-1 py-1 text-left">Enseignants</th>
              <th className="border px-1 py-1 text-left">Discipline</th>
              <th className="border px-1 py-1 text-center">Moyenne de la Classe</th>
              <th className="border px-1 py-1 text-center">Plus faible moyenne</th>
              <th className="border px-1 py-1 text-center">Plus forte moyenne</th>
              <th className="border px-1 py-1 text-center">Appréciations</th>
              <th className="border px-1 py-1 text-center">Emargement</th>
            </tr>
          </thead>
          <tbody>
            {d.disciplines.map(disc => (
              <tr key={disc.nom}>
                <td className="border px-1 py-1 text-[9px]">{disc.enseignantMatricule}</td>
                <td className="border px-1 py-1 text-[9px]">{disc.enseignant}</td>
                <td className="border px-1 py-1">{disc.nom}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.moyenneClasse)}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.plusFaibleMoyenne)}</td>
                <td className="border px-1 py-1 text-center">{fmtNum(disc.plusForteMoyenne)}</td>
                <td className="border px-1 py-1 text-center">{disc.appreciation}</td>
                <td className="border px-1 py-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-center text-xs font-bold mt-4" style={{ color: '#06072d' }}>
          MOYENNE GENERALE DE LA CLASSE: {fmtNum(d.moyenneClasse)}
        </p>

        <div className="mt-6 space-y-4 text-xs">
          <div><span className="font-bold underline">CONDUITE DE LA CLASSE :</span></div>
          <div><span className="font-bold underline">OBSERVATIONS :</span></div>
        </div>

        <div className="flex justify-between mt-10 text-xs">
          <div><p className="font-semibold">Professeur Principal</p></div>
          <div className="text-right">
            <p>COCODY, le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            <p className="font-semibold">Chef d'établissement</p>
          </div>
        </div>

        <ReportFooter />
      </div>
    </div>
  );
}
