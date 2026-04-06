# K12net Dashboard — De l'enseignement supérieur au secondaire

## Introduction

Après le succès de l'EMSP Dashboard pour la gestion des conseils de classe en enseignement supérieur, nous sommes heureux d'annoncer **K12net Dashboard** — une refonte complète de l'application pour répondre aux besoins spécifiques des établissements secondaires (collège et lycée) en Côte d'Ivoire.

## Pourquoi cette transformation ?

L'EMSP Dashboard a été conçu autour du système LMD (Licence-Master-Doctorat) avec des UE, ECUE, crédits et un modèle semestriel. Les établissements du secondaire fonctionnent différemment :

- **3 trimestres** au lieu de 2 semestres
- **Matières avec coefficients** au lieu du système UE/ECUE/crédits
- **Distinctions et sanctions** trimestrielles (Tableau d'Honneur, Blâme, etc.)
- **Promotion annuelle** avec trois issues : Admis, Redouble, ou Exclu
- **Orientation filière** automatique pour les élèves du lycée

## Ce qui change

### Un nouveau moteur de règles

Le cœur de K12net Dashboard est un **moteur de règles configurable par année académique**. Basé sur les règles du Lycée Sainte Marie de Cocody (Abidjan), il gère :

#### Distinctions trimestrielles

Chaque trimestre, les élèves méritants sont automatiquement identifiés :

| Distinction | Condition |
|-------------|-----------|
| **Tableau d'Honneur (TH)** | Moyenne ≥ 12-12.5 selon le niveau |
| **Tableau d'Excellence (THE)** | Moyenne ≥ 13 |
| **Tableau de Félicitations (THF)** | Moyenne ≥ 14 |

Si un élève a des matières en dessous de 10, la distinction est assortie d'une **réserve** (THR, THER, THFR).

#### Sanctions

| Sanction | Condition |
|----------|-----------|
| **BTI** — Blâme de Travail Insuffisant | Moyenne < 8.5 |
| **AVT** — Avertissement de Travail | Moyenne < 10 |
| **BMC** — Blâme de Mauvaise Conduite | Note de conduite < 10 |
| **AMC** — Avertissement Mauvaise Conduite | Note de conduite < 11 |

#### Décisions de promotion

En fin d'année, le système calcule automatiquement :

- **ADMIS** : Moyenne annuelle ≥ 10
- **REDOUBLE** : Moyenne entre 8.5 et 10 (première fois)
- **EXCLU** : Moyenne < 8.5, ou redoublant qui échoue

#### Orientation filière automatique

Pour les élèves du lycée, le système suggère automatiquement la filière de l'année suivante en fonction des notes dans les matières clés (Maths, Physique-Chimie, SVT, etc.).

### Des règles qui évoluent

Les règles ne sont pas figées. Le système supporte trois jeux de règles (2022, 2023, 2024) avec des différences notables :

- **2022** : Seuils de distinction uniformes, règles de promotion plus souples pour les classes terminales
- **2023-2024** : Seuils différenciés collège/lycée, vérification de la composition de français, exclusion automatique des redoublants en classes terminales

L'administrateur peut configurer les règles de chaque année via l'interface d'administration.

### Une nouvelle base de données

K12net Dashboard utilise un **nouveau projet Firebase** indépendant de l'ancien EMSP Dashboard. Cela garantit :

- Séparation totale des données
- Configuration de sécurité adaptée
- Possibilité d'évoluer indépendamment

### Structure Firestore adaptée

```
globalSettings/default
  └── yearConfigs: configurations par année académique
  └── subjectCatalog: catalogue de matières par niveau

sessions/{id}
  └── academicYear, rulesConfig
  └── classes/{id}: notes des élèves
  └── snapshots/{id}: historique des versions
```

## Stack technique

La stack reste moderne et éprouvée :

- **React 19** + **TypeScript** + **Vite** pour le développement rapide
- **Tailwind CSS v4** pour le style
- **Firebase** (Auth, Firestore) pour le backend
- **Recharts** pour les visualisations
- **i18next** pour l'internationalisation (FR/EN)
- Export vers **Excel, PDF, Word**

## Fichiers clés

| Fichier | Description |
|---------|-------------|
| `src/types/k12.ts` | Tous les types domaine K12 (élèves, notes, résultats, règles) |
| `src/utils/k12RulesEngine.ts` | Moteur de règles complet avec configs 2022/2023/2024 |
| `src/lib/firebase-k12.ts` | Configuration du nouveau projet Firebase |
| `SPEC.md` | Spécifications techniques détaillées |

## Prochaines étapes

1. **Adapter les composants UI** : Dashboard, liste des élèves, fiche élève
2. **Adapter l'import Excel** : Parser pour le format des bulletins K12
3. **Adapter le PV de conseil** : Génération du document avec distinctions/sanctions
4. **Tests** : Validation du moteur de règles avec des données réelles
5. **Déploiement** : Mise en production avec le nouveau projet Firebase

## Conclusion

K12net Dashboard représente une évolution majeure : même architecture moderne éprouvée, mais un domaine métier entièrement repensé pour le secondaire ivoirien. Le moteur de règles configurable par année académique garantit la flexibilité nécessaire pour s'adapter aux changements réglementaires.

---

*K12net Dashboard — Tableau de bord de conseil de classe pour le secondaire*
