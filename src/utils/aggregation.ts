/**
 * Generic aggregation function for multi-level education data.
 *
 * Reusable at every level:
 *   agreger(classes[])         → stats établissement
 *   agreger(établissements[])  → stats DRENA
 *   agreger(drenas[])          → stats ministère
 */
import type { EntiteEnfant, AggregationResult } from '../types/multiLevel';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ecartType(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function agreger(enfants: EntiteEnfant[]): AggregationResult {
  if (enfants.length === 0) {
    return {
      effectif_total: 0,
      moyenne_ponderee: 0,
      mediane: 0,
      ecart_type: 0,
      coefficient_variation: 0,
      taux_reussite: 0,
      taux_excellence: 0,
      taux_echec: 0,
      taux_felicitations: 0,
      nb_entites: 0,
      min_moyenne: 0,
      max_moyenne: 0,
      ecart_max: 0,
      entite_meilleure: '',
      entite_plus_faible: '',
      classement: [],
    };
  }

  const effectif_total = enfants.reduce((s, e) => s + e.effectif, 0);

  // Weighted average by effectif
  const totalWeighted = enfants.reduce((s, e) => s + e.moyenne * e.effectif, 0);
  const moyenne_ponderee = effectif_total > 0 ? totalWeighted / effectif_total : 0;

  // Median of entity averages
  const moyennes = enfants.map(e => e.moyenne);
  const med = median(moyennes);

  // Standard deviation of entity averages
  const sigma = ecartType(moyennes);
  const cv = moyenne_ponderee > 0 ? (sigma / moyenne_ponderee) * 100 : 0;

  // Aggregate counts
  const total_reussite = enfants.reduce((s, e) => s + e.nb_reussite, 0);
  const total_excellence = enfants.reduce((s, e) => s + e.nb_excellence, 0);
  const total_echec = enfants.reduce((s, e) => s + e.nb_echec, 0);
  const total_felicitations = enfants.reduce((s, e) => s + e.nb_felicitations, 0);

  const taux_reussite = effectif_total > 0 ? (total_reussite / effectif_total) * 100 : 0;
  const taux_excellence = effectif_total > 0 ? (total_excellence / effectif_total) * 100 : 0;
  const taux_echec = effectif_total > 0 ? (total_echec / effectif_total) * 100 : 0;
  const taux_felicitations = effectif_total > 0 ? (total_felicitations / effectif_total) * 100 : 0;

  // Min / Max
  const min_moyenne = Math.min(...moyennes);
  const max_moyenne = Math.max(...moyennes);
  const ecart_max = max_moyenne - min_moyenne;

  // Best / Worst
  const sorted = [...enfants].sort((a, b) => b.moyenne - a.moyenne);
  const entite_meilleure = sorted[0]?.nom ?? '';
  const entite_plus_faible = sorted[sorted.length - 1]?.nom ?? '';

  // Ranking
  const classement = sorted.map((e, i) => ({
    nom: e.nom,
    moyenne: e.moyenne,
    rang: i + 1,
  }));

  return {
    effectif_total,
    moyenne_ponderee: Math.round(moyenne_ponderee * 100) / 100,
    mediane: Math.round(med * 100) / 100,
    ecart_type: Math.round(sigma * 100) / 100,
    coefficient_variation: Math.round(cv * 100) / 100,
    taux_reussite: Math.round(taux_reussite * 100) / 100,
    taux_excellence: Math.round(taux_excellence * 100) / 100,
    taux_echec: Math.round(taux_echec * 100) / 100,
    taux_felicitations: Math.round(taux_felicitations * 100) / 100,
    nb_entites: enfants.length,
    min_moyenne: Math.round(min_moyenne * 100) / 100,
    max_moyenne: Math.round(max_moyenne * 100) / 100,
    ecart_max: Math.round(ecart_max * 100) / 100,
    entite_meilleure,
    entite_plus_faible,
    classement,
  };
}

/**
 * Compute inter-annual delta for any numeric indicator.
 *
 * @param current Current year value
 * @param previous Previous year value
 * @returns { delta, direction, percentage }
 */
export function computeDelta(
  current: number,
  previous: number,
): { delta: number; direction: 'up' | 'down' | 'stable'; percentage: number | null } {
  const delta = current - previous;
  const direction = delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'stable';
  const percentage = previous !== 0 ? Math.round(((delta / Math.abs(previous)) * 100) * 100) / 100 : null;
  return { delta: Math.round(delta * 100) / 100, direction, percentage };
}

/**
 * Compute Gini coefficient for disparity measurement at national level.
 */
export function computeGini(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;

  let sumAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbsDiff += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return Math.round((sumAbsDiff / (2 * n * n * mean)) * 10000) / 10000;
}
