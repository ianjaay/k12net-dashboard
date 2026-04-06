# Compte rendu d'analyse des rapports K12 — Brief pour Claude Code

> Document d'analyse et de propositions à destination de Claude Code (Opus 4.6)
> Basé sur 7 rapports officiels du Lycée Sainte Marie de Cocody — Classe 6ème_2
> Deuxième Trimestre, Année Scolaire 2025-2026
> Date : 4 avril 2026

---

## Sommaire

1. [Données source et structure observée](#1-données-source-et-structure-observée)
2. [Analyse des indicateurs extractibles par rapport](#2-analyse-des-indicateurs-extractibles-par-rapport)
3. [Spécification des cartes métriques avec deltas de performance](#3-spécification-des-cartes-métriques-avec-deltas-de-performance)
4. [Rapport de progression individuelle](#4-rapport-de-progression-individuelle)
5. [Diagramme radar élève vs classe](#5-diagramme-radar-élève-vs-classe)
6. [Système d'alertes et signaux automatiques](#6-système-dalertes-et-signaux-automatiques)
7. [Rapports et indicateurs supplémentaires proposés](#7-rapports-et-indicateurs-supplémentaires-proposés)
8. [Récapitulatif des composants à développer](#8-récapitulatif-des-composants-à-développer)

---

## 1. Données source et structure observée

### 1.1 Les 7 rapports analysés

Les 7 fichiers PDF fournis représentent les rapports standards générés par le système d'information scolaire en fin de trimestre. Voici la nature de chacun et les données qu'il contient :

**Rapport 1 — PV Provisoire de Conseil de Classe** (3 pages)
- Page 1 : effectifs (G/F/Total), répartition des moyennes en 3 tranches (<8,5 / 8,5≤Moy<10 / ≥10) ventilée par genre, moyenne/min/max de la classe, tableau des distinctions (TH, THE, THF) et sanctions (blâmes, avertissements, TH refusé)
- Page 2 : tableau disciplinaire — pour chaque discipline : effectif classé, moyenne classe, enseignant, répartition en 3 tranches (nombre + %)
- Page 3 : même tableau enrichi avec matricule enseignant, min/max par discipline, appréciation textuelle, zones de signature et observations libres

**Rapport 2 — Liste des Majors par Classe** (1 page)
- Une ligne par classe : matricule, nom, sexe, date naissance, nationalité, redoublant, LV2, moyenne, classe du major

**Rapport 3 — Liste des Majors par Niveau** (1 page)
- Une ligne par niveau (Sixième à Terminale) : même structure, le major étant le meilleur élève tous groupes confondus pour un niveau donné

**Rapport 4 — Liste des Premiers par Discipline** (1 page)
- Pour la classe 6ème_2 : une ligne par discipline avec l'élève ayant la meilleure note, sa moyenne disciplinaire et une observation/appréciation

**Rapport 5 — Liste des Non-Classés** (1 page)
- Élèves sans moyenne au trimestre (absences, notes insuffisantes pour classement). Dans notre jeu de données : liste vide (bon signe d'assiduité)

**Rapport 6 — Liste Nominative par Ordre Alphabétique** (2 pages)
- Les 48 élèves avec : matricule, nom, nationalité, sexe, affectation, redoublant, moyenne T2, rang T2, distinction/sanction T2

**Rapport 7 — Bilan Annuel (Rapports de Classe et Niveau)** (2 pages)
- Tableau longitudinal par élève : Moy T1, Rang T1, D/S T1, Moy T2, Rang T2, D/S T2, colonnes T3 vides, puis Moy annuelle, Rang annuel, DFA, Niveau supérieur (ces 4 dernières colonnes sont vides, renseignées en fin d'année)

### 1.2 Données disponibles pour la classe 6ème_2

**Classe** : 6ème_2, Lycée Sainte Marie de Cocody, Abidjan
**Effectif** : 48 filles, 0 garçons
**Professeur principal** : M. AKPI JEAN-JACQUES
**Éducateur** : Mme. TRAORE EPSE GOULE GEANNOUROU
**Trimestre courant** : T2 (données T1 et T2 disponibles, T3 non encore renseigné)

**Données par trimestre disponibles** :
- T1 : moyenne, rang, distinction/sanction pour chaque élève
- T2 : moyenne, rang, distinction/sanction pour chaque élève + détail par discipline (moyenne classe, répartition, enseignant, appréciation)

**16 disciplines évaluées** : Français, Anglais, Histoire-Géographie, Mathématiques, Physique-Chimie, SVT, Allemand (LV2), Informatique, EPS, Éducation Musicale, Arts Plastiques, E.D.H.C, Environnement, ESF/Couture, Conduite, Danse. Plus 3 disciplines sans effectif : Éducation Religieuse, CDI, AVIS.

### 1.3 Observations clés sur les données

- **Redoublement** : la colonne RED (redoublant) est disponible dans le bilan annuel mais n'est pas renseignée trimestre par trimestre — c'est un attribut annuel de l'élève
- **Notes par discipline par élève** : le PV de conseil de classe contient les moyennes par discipline au niveau CLASSE (pas par élève). Les notes individuelles par discipline ne sont disponibles que pour identifier les "premiers" (rapport 4). Pour le radar complet, il faudra soit un fichier de données supplémentaire, soit extraire les notes depuis le système source
- **Distinctions** : le système utilise des codes composites (THF = Tableau d'Honneur + Félicitations, THER = TH + Encouragements + Refusé, etc.) qui combinent reconnaissance et sanction comportementale
- **Rangs ex-aequo** : le suffixe "ex" (ex: "26ex") signifie que plusieurs élèves partagent ce rang ; le rang suivant saute (après 2 élèves à 26ex, le suivant est 28ème)

---

## 2. Analyse des indicateurs extractibles par rapport

### 2.1 Depuis le PV de Conseil de Classe

**Indicateurs de niveau classe :**
| Indicateur | Valeur observée (T2) | Formule / Source |
|---|---|---|
| Moyenne générale de la classe | 14,92 | Moyenne arithmétique des moyennes individuelles |
| Plus faible moyenne | 10,97 | Min des moyennes |
| Plus forte moyenne | 17,19 | Max des moyennes |
| Étendue | 6,22 | Max - Min |
| Taux de réussite (≥10) | 100% (48/48) | Nb(Moy≥10) / Effectif classé |
| Taux d'échec (<8,5) | 0% (0/48) | Nb(Moy<8,5) / Effectif classé |
| Taux zone intermédiaire (8,5-10) | 0% (0/48) | Nb(8,5≤Moy<10) / Effectif classé |

**Indicateurs disciplinaires :**
| Discipline | Moy. Classe | % <8,5 | % 8,5-10 | % ≥10 | Appréciation |
|---|---|---|---|---|---|
| Histoire-Géographie | 16,89 | 0% | 0% | 100% | Excellent |
| Anglais | 16,36 | 0% | 0% | 100% | Excellent |
| Éducation Musicale | 15,44 | 0% | 0% | 100% | Bien |
| E.D.H.C | 15,17 | 0% | 0% | 100% | Bien |
| Conduite | 14,58 | 0% | 0% | 100% | Bien |
| Informatique | 14,55 | 0% | 2,08% | 97,92% | Bien |
| Français | 14,07 | 0% | 0% | 100% | Bien |
| Mathématiques | 13,89 | 0% | 2,08% | 97,92% | Assez Bien |
| SVT | 13,89 | 0% | 4,17% | 95,83% | Assez Bien |
| Arts Plastiques | 13,76 | 0% | 0% | 100% | Assez Bien |
| EPS | 13,64 | 0% | 0% | 100% | Assez Bien |
| Environnement | 13,56 | 0% | 0% | 100% | Assez Bien |
| Physique-Chimie | 12,95 | 6,25% | 12,5% | 81,25% | Assez Bien |
| ESF/Couture | 12,08 | 0% | 0% | 100% | Assez Bien |
| Danse | 6,22 | 0% | 0% | 100% | Excellent |
| **Allemand** | **5,25** | **2,08%** | **8,33%** | **89,58%** | **Bien** |

**Indicateurs dérivés proposés :**
- Nombre de disciplines critiques (moyenne classe < 10) : 2 (Allemand 5,25, Danse 6,22)
- Discipline la plus problématique en échec individuel : Physique-Chimie (3 élèves < 8,5 soit 6,25%)
- Écart disciplinaire maximum : 16,89 - 5,25 = 11,64 points (Hist-Géo vs Allemand)
- Disciplines avec élèves en difficulté (≥1 élève <8,5) : Physique-Chimie (3), Allemand (1)

**Indicateurs distinctions/sanctions :**
| Catégorie | Nombre | % |
|---|---|---|
| THF (Félicitations) | 35 | 72,9% |
| THFR (Félicitations + comportement refusé) | 2 | 4,2% |
| THER (Encouragements + comportement refusé) | 8 | 16,7% |
| THR (TH Refusé) | 3 | 6,3% |
| Sans distinction | 0 | 0% |
| TH Refusé (sanction) | 12 | 25% |
| Blâmes et avertissements | 0 | 0% |

### 2.2 Depuis le Bilan Annuel (T1 → T2)

**Indicateurs d'évolution (calculés à partir des 48 élèves) :**

| Indicateur | Valeur | Interprétation |
|---|---|---|
| Élèves en progression (delta > +0,3) | ~25 | ~52% de la classe |
| Élèves en régression (delta < -0,3) | ~15 | ~31% de la classe |
| Élèves stables (\|delta\| ≤ 0,3) | ~8 | ~17% de la classe |
| Plus forte progression | ABO KADET : +1,89 pt (12,99→14,88), +18 places | Signal très positif |
| Plus forte régression | KONAN Maelys : -1,26 pt (16,84→15,58), -11 places | À surveiller |
| Major stable ? | Oui — BOKO Marie Keren 1ère T1 et T2 | Stabilité du leadership |
| Mobilité classement (≥5 places) | ~20 élèves | Classe assez mobile |

**Élèves avec les plus forts deltas (extrait) :**
| Élève | Moy T1 | Rang T1 | Moy T2 | Rang T2 | Delta moy | Delta rang |
|---|---|---|---|---|---|---|
| ABO KADET S. | 12,99 | 44è | 14,88 | 26ex | +1,89 | +18 |
| MEITE Nohossa B. | 14,78 | 22è | 16,00 | 11è | +1,22 | +11 |
| BARUXAKIS E. | 13,79 | 38è | 14,82 | 28è | +1,03 | +10 |
| KOUASSI NEHI C. | 13,63 | 41è | 14,63 | 31è | +1,00 | +10 |
| KONAN Maelys | 16,84 | 3è | 15,58 | 14è | -1,26 | -11 |
| KADJO Keren P. | 14,56 | 26è | 13,38 | 43è | -1,18 | -17 |
| GUETTEY Marie-A. | 16,80 | 4è | 15,76 | 13è | -1,04 | -9 |

### 2.3 Depuis les Majors et Premiers

**Major de classe T2** : BOKO Marie Keren Cassandra (17,19) — même qu'en T1 (17,41)
**Major de niveau Sixième** : GBALE Abisse Marie Tiphanie (18,40) dans une autre classe — la 6ème_2 n'a pas le major du niveau

**Concentration des "Premiers par Discipline"** :
| Élève | Nombre de disciplines où 1ère | Disciplines |
|---|---|---|
| BOKO Marie Keren C. | 3 | Mathématiques (18), Histoire-Géo (19), Français (16,67) |
| TOURE Cyra Alysha M. | 2 | Informatique (19), Éducation Musicale (18) |
| AGNIMAN Hamaco Marie P. | 2 | Environnement (15), Anglais (19) |
| Autres (1 chacune) | 8 | 1 discipline chacune |

→ Indicateur de "polyvalence" : BOKO est l'élève la plus polyvalente avec 3 premières places.

---

## 3. Spécification des cartes métriques avec deltas de performance

### 3.1 Principe général

Chaque carte métrique du dashboard affiche :
1. **La valeur actuelle** (ex: Moyenne classe T2 = 14,92)
2. **Un indicateur de performance (delta)** par rapport au(x) trimestre(s) précédent(s)

Le delta s'affiche comme un badge coloré avec flèche :
- `▲ +0,45` en vert si progression
- `▼ -0,32` en rouge si régression
- `= 0,02` en gris si stable (seuil : |delta| < 0,1)

### 3.2 Logique de calcul des deltas selon le trimestre courant

```
SI trimestre_courant == T1 :
    Pas de delta (pas de référence antérieure)
    
SI trimestre_courant == T2 :
    delta = valeur_T2 - valeur_T1
    Afficher : "vs T1 : ▲/▼ {delta}"
    
SI trimestre_courant == T3 :
    delta_vs_T2 = valeur_T3 - valeur_T2
    delta_vs_T1 = valeur_T3 - valeur_T1
    Afficher deux lignes :
        "vs T2 : ▲/▼ {delta_vs_T2}"
        "vs T1 : ▲/▼ {delta_vs_T1}"
```

### 3.3 Application aux cartes du dashboard

#### Bloc "Synthèse Classe"

| Carte | Valeur T2 | Delta affiché (T2 vs T1) | Calcul du delta |
|---|---|---|---|
| Moyenne de la classe | 14,92 | vs T1 : ▲/▼ (Moy_T2 - Moy_T1) | Besoin de la moyenne classe T1 |
| Médiane | Valeur T2 | vs T1 : ▲/▼ (Médiane_T2 - Médiane_T1) | Trier les moyennes, prendre le milieu |
| Écart-type | σ(T2) | vs T1 : ▲/▼ (σ_T2 - σ_T1) | Si σ baisse = classe plus homogène (positif) |
| Plus faible moyenne | 10,97 | vs T1 : ▲/▼ (Min_T2 - Min_T1) | Si min monte = les plus faibles progressent |
| Plus forte moyenne | 17,19 | vs T1 : ▲/▼ (Max_T2 - Max_T1) | |
| Étendue (Max-Min) | 6,22 | vs T1 : ▲/▼ | Si étendue baisse = resserrement |
| Taux réussite (≥10) | 100% | vs T1 : ▲/▼ | |
| Quartile Q1 (25%) | Valeur T2 | vs T1 : ▲/▼ | Seuil en dessous duquel se trouvent 25% des élèves |
| Quartile Q3 (75%) | Valeur T2 | vs T1 : ▲/▼ | |

**Note sur la médiane et les quartiles** : ces indicateurs sont plus robustes que la moyenne car ils ne sont pas affectés par les valeurs extrêmes. Pour une classe de 48 élèves :
- Médiane = moyenne de la 24ème et 25ème valeur (triées)
- Q1 = 12ème valeur
- Q3 = 36ème valeur

#### Bloc "Distinctions / Sanctions"

| Carte | Valeur T2 | Delta affiché |
|---|---|---|
| Nb THF | 35 | vs T1 : ▲/▼ (THF_T2 - THF_T1) |
| Nb Sanctions | 12 | vs T1 : ▲/▼ |
| Taux de félicitations | 72,9% | vs T1 : ▲/▼ en points de % |
| Indice climat scolaire | ICS calculé | vs T1 : ▲/▼ |

#### Bloc "Disciplines" (cartes par discipline)

| Carte par discipline | Valeur T2 | Delta affiché |
|---|---|---|
| Moy. classe Maths | 13,89 | vs T1 : ▲/▼ (Moy_Maths_T2 - Moy_Maths_T1) |
| % échec (<8,5) Physique | 6,25% | vs T1 : ▲/▼ |
| Nb disciplines critiques | 2 | vs T1 : ▲/▼ |

**Important** : les moyennes par discipline au niveau de la classe au T1 ne sont pas dans nos données T2 actuelles (le PV est uniquement pour T2). Pour calculer les deltas disciplinaires, il faudra soit disposer du PV T1, soit que l'application stocke les données de chaque trimestre au fur et à mesure de l'import.

### 3.4 Comportement du composant DeltaBadge

```typescript
interface DeltaBadgeProps {
  currentValue: number;
  previousValues: {
    label: string;        // "T1" ou "T2"
    value: number;
  }[];
  format: "number" | "percent" | "rank";
  invertColor?: boolean;  // true pour les métriques où "baisser" est positif (ex: écart-type, étendue)
  precision?: number;     // nombre de décimales (défaut: 2)
}

// Exemples de rendu :
// format="number" : "vs T1 : ▲ +0,45"
// format="percent" : "vs T1 : ▲ +2,3 pts"
// format="rank" : "vs T1 : ▲ +5 places"
// invertColor=true + delta négatif : affiché en VERT (baisser l'écart-type est positif)
```

### 3.5 Composant MetricCard avec delta

```typescript
interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  deltas: {
    reference: string;    // "T1", "T2"
    value: number;
    format: "number" | "percent" | "rank";
    invertColor?: boolean;
  }[];
}

// Rendu visuel :
// ┌────────────────────────┐
// │ Moyenne de la classe   │  ← label (gris, 12px)
// │ 14,92                  │  ← value (noir, 24px, bold)
// │ ▲ +0,45 vs T1          │  ← delta (vert/rouge, 12px)
// └────────────────────────┘

// En T3, deux lignes de delta :
// ┌────────────────────────┐
// │ Moyenne de la classe   │
// │ 15,20                  │
// │ ▲ +0,28 vs T2          │  ← delta vs T2
// │ ▲ +0,73 vs T1          │  ← delta vs T1
// └────────────────────────┘
```

---

## 4. Rapport de progression individuelle

### 4.1 Objectif

Produire pour chaque élève un rapport de progression consultable dans la fiche détail et exportable en PDF (pour les parents ou le conseil de classe). Ce rapport montre l'évolution de l'élève entre les trimestres sur plusieurs dimensions.

### 4.2 Structure du rapport de progression

#### En-tête élève
- Nom et prénoms, matricule, classe, année scolaire
- Photo (si disponible)

#### Section 1 — Cartes synthèse avec deltas

4 cartes métriques :

| Carte | Contenu |
|---|---|
| Moyenne | Valeur T courant + delta(s) vs trimestre(s) précédent(s) |
| Rang | Rang T courant + delta(s) exprimé en places gagnées/perdues |
| Distinction | Code distinction T courant + évolution (ex: "THR → THF") |
| Position relative | Écart par rapport à la moyenne de la classe (ex: "+2,27 pts au-dessus") |

#### Section 2 — Graphique d'évolution des moyennes

- Type : Line chart
- Axe X : T1, T2, T3 (T3 vide si pas encore disponible)
- Axe Y : Moyenne (échelle 0-20)
- Deux courbes : moyenne de l'élève (couleur primaire) + moyenne de la classe (gris pointillé)
- Points interactifs avec tooltip : "T2 : 14,88 (classe : 14,92)"

#### Section 3 — Graphique d'évolution du rang

- Type : Line chart (axe Y inversé : 1 en haut, 48 en bas)
- Montre la trajectoire de rang
- Zone verte (top 25%), zone orange (25-75%), zone rouge (bottom 25%)

#### Section 4 — Tableau détaillé trimestre par trimestre

| Période | Moyenne | Rang | Distinction | Delta Moy | Delta Rang |
|---|---|---|---|---|---|
| T1 | 12,99 | 44ème | THR | — | — |
| T2 | 14,88 | 26ex | THF | ▲ +1,89 | ▲ +18 places |
| T3 | — | — | — | — | — |

#### Section 5 — Radar disciplinaire (voir section 5 ci-dessous)

#### Section 6 — Indicateurs de tendance

| Indicateur | Calcul | Interprétation |
|---|---|---|
| Tendance | Régression linéaire sur les moyennes disponibles | Pente positive = trajectoire ascendante |
| Prévision T3 (si T1+T2 dispo) | Extrapolation linéaire | Estimation indicative |
| Volatilité | Écart-type des moyennes entre trimestres | Stable < 0,5 ; Modéré 0,5-1 ; Volatile > 1 |
| Position dans la classe | Percentile de l'élève | "Meilleur que 75% de la classe" |

### 4.3 Export PDF du rapport de progression

Le rapport de progression individuelle est exportable en PDF avec :
- En-tête officiel de l'établissement
- Données de l'élève
- Graphiques rendus en image (canvas → image)
- Signature du professeur principal

---

## 5. Diagramme radar élève vs classe

### 5.1 Objectif

Afficher dans la fiche détail de chaque élève un diagramme radar qui superpose :
- **Courbe 1 (couleur primaire, remplie)** : les notes de l'élève dans chaque discipline
- **Courbe 2 (gris, pointillée)** : la moyenne de la classe dans chaque discipline

Cela permet en un coup d'œil d'identifier les points forts et les lacunes de l'élève par rapport au niveau moyen de sa classe.

### 5.2 Données nécessaires

Pour construire le radar, il faut pour chaque élève :
- Sa note dans chaque discipline (note individuelle)
- La moyenne de la classe dans chaque discipline (depuis le PV)

**Attention** : dans les données actuelles, le PV de conseil de classe contient les moyennes par discipline au niveau CLASSE, mais pas les notes individuelles par discipline pour chaque élève. Les notes individuelles par discipline nécessitent soit :
- Un fichier source supplémentaire (ex: export du bulletin individuel)
- Le fichier Excel brut du système d'information avec les notes détaillées

Si les notes individuelles par discipline ne sont pas disponibles, le radar peut être construit avec les données du rapport "Premiers par Discipline" uniquement pour les premiers de chaque matière.

**Proposition** : prévoir dans l'import de données un fichier de type "bulletin individuel" ou "notes détaillées" contenant pour chaque élève ses notes par discipline. Structure attendue :

```typescript
interface NotesDisciplinaireEleve {
  matricule: string;
  discipline: string;
  note_cc: number;       // Contrôle continu (si disponible)
  note_examen: number;   // Note d'examen (si disponible)
  moyenne: number;       // Moyenne discipline pour cet élève
}
```

### 5.3 Configuration du radar

```typescript
interface RadarConfig {
  // Disciplines à afficher (toutes par défaut, possibilité de filtrer)
  disciplines: string[];
  
  // Échelle
  min: 0;
  max: 20;
  stepSize: 5;  // Graduations à 5, 10, 15, 20
  
  // Datasets
  datasets: [
    {
      label: "Élève";
      data: number[];       // Notes de l'élève
      borderColor: "#534AB7";  // Violet
      backgroundColor: "rgba(83,74,183,0.15)";
      pointRadius: 3;
    },
    {
      label: "Moyenne classe";
      data: number[];       // Moyennes classe
      borderColor: "rgba(0,0,0,0.2)";
      backgroundColor: "rgba(0,0,0,0.04)";
      borderDash: [4, 4];
      pointRadius: 0;
    }
  ];
}
```

### 5.4 Indicateurs complémentaires au radar

Au-dessus ou à côté du radar, afficher :

| Indicateur | Calcul |
|---|---|
| Disciplines au-dessus de la classe | Nb de disciplines où note_élève > moy_classe |
| Disciplines en dessous de la classe | Nb de disciplines où note_élève < moy_classe |
| Meilleure discipline | Discipline avec la plus forte note |
| Discipline la plus faible | Discipline avec la plus faible note |
| Écart moyen avec la classe | Moyenne des (note_élève - moy_classe) |
| Profil disciplinaire | "Littéraire", "Scientifique", "Équilibré" — basé sur les clusters de notes |

### 5.5 Profil disciplinaire automatique

Regrouper les disciplines en familles :
- **Littéraires** : Français, Anglais, Allemand, Histoire-Géographie, E.D.H.C
- **Scientifiques** : Mathématiques, Physique-Chimie, SVT, Informatique
- **Artistiques/Pratiques** : Éducation Musicale, Arts Plastiques, Danse, ESF/Couture, EPS
- **Transversales** : Environnement, Conduite

Calculer la moyenne de l'élève dans chaque famille, puis déterminer :
- Si moy_littéraire > moy_scientifique + 2 → "Profil littéraire"
- Si moy_scientifique > moy_littéraire + 2 → "Profil scientifique"
- Sinon → "Profil équilibré"

---

## 6. Système d'alertes et signaux automatiques

### 6.1 Objectif

Générer automatiquement des alertes visuelles sur le dashboard et dans la fiche élève pour signaler les situations nécessitant l'attention du conseil de classe.

### 6.2 Règles d'alerte

#### Alertes individuelles (par élève)

| Code alerte | Condition | Sévérité | Message type |
|---|---|---|---|
| `REG_FORTE` | Delta moyenne ≤ -1,0 pt | Danger | "{nom} : chute de {delta} pts" |
| `REG_MODEREE` | -1,0 < Delta moyenne ≤ -0,5 | Warning | "{nom} : régression modérée" |
| `CHUTE_RANG` | Perte ≥ 10 places au classement | Warning | "{nom} : recul de {n} places" |
| `PERTE_DISTINCTION` | Passage THF→THER ou THF→THR ou THF→rien | Warning | "{nom} : perte de félicitations" |
| `SEUIL_CRITIQUE` | Moyenne < 10 | Danger | "{nom} : sous le seuil de 10" |
| `ZONE_FRAGILE` | 10 ≤ Moyenne < 11 | Warning | "{nom} : zone fragile" |
| `PROG_FORTE` | Delta moyenne ≥ +1,5 pt | Succès | "{nom} : progression remarquable" |
| `PROG_MODEREE` | +0,5 ≤ Delta moyenne < +1,5 | Info | "{nom} : en progression" |
| `GAIN_DISTINCTION` | Passage de THR/THER/rien → THF | Succès | "{nom} : obtention des félicitations" |
| `DERNIERS_10PCT` | Rang dans les 10% inférieurs | Warning | "{nom} : dans le dernier décile" |

#### Alertes disciplinaires (par matière)

| Code alerte | Condition | Sévérité | Message type |
|---|---|---|---|
| `DISC_ECHEC` | Moyenne classe < 10 | Danger | "{discipline} : moyenne classe en échec ({moy})" |
| `DISC_ECHEC_ELEVES` | ≥ 10% d'élèves < 8,5 | Warning | "{discipline} : {n} élèves en grande difficulté" |
| `DISC_REGRESSION` | Moy discipline T2 < Moy discipline T1 - 1 | Warning | "{discipline} : régression significative" |

#### Alertes classe (globales)

| Code alerte | Condition | Sévérité | Message type |
|---|---|---|---|
| `CLASSE_REGRESSION` | Moyenne classe T2 < Moyenne classe T1 | Warning | "Régression de la moyenne de classe" |
| `HOMOGENEITE_BAISSE` | Écart-type T2 > Écart-type T1 + 0,5 | Info | "Augmentation de l'hétérogénéité" |
| `NON_CLASSES_ELEVES` | Nombre de non-classés > 0 | Warning | "{n} élève(s) non classé(s)" |

### 6.3 Affichage des alertes

Sur le dashboard : un compteur d'alertes par sévérité (ex: "3 dangers, 5 warnings, 2 succès") avec possibilité de cliquer pour voir le détail.

Dans la fiche élève : les alertes concernant cet élève sont affichées en haut de la fiche.

### 6.4 Profilage automatique des élèves

Classifier chaque élève dans une catégorie basée sur ses données multi-trimestres :

| Profil | Critères | Icône/Couleur |
|---|---|---|
| Excellent stable | Moyenne ≥ 16 sur tous les trimestres disponibles, top 10 | Vert foncé |
| Bon en progression | Moyenne ≥ 14 ET delta positif ≥ 0,5 | Vert |
| Stable milieu de classe | 12 ≤ Moyenne < 16 ET |delta| < 0,5 | Gris |
| En progression | Delta ≥ +1,0 pt OU gain ≥ 10 places | Bleu |
| En décrochage | Delta ≤ -1,0 pt OU perte ≥ 10 places | Orange |
| Fragile | Moyenne < 12 OU dans les derniers 10% | Rouge |

---

## 7. Rapports et indicateurs supplémentaires proposés

### 7.1 Nouveaux rapports à construire (au-delà des 7 officiels)

#### Rapport A — Rapport de progression individuelle
- Contenu : voir section 4
- Usage : fiche élève + export PDF pour parents
- Déclencheur : disponible dès que ≥ 2 trimestres sont importés

#### Rapport B — Rapport d'alertes pour le conseil de classe
- Contenu : toutes les alertes générées (section 6), triées par sévérité
- Usage : document de travail pour le conseil de classe
- Format : tableau avec colonnes Sévérité, Élève/Discipline, Message, Données

#### Rapport C — Rapport de profils de classe
- Contenu : répartition des élèves par profil (section 6.4)
- Visualisation : diagramme en barres empilées ou doughnut
- Usage : vue synthétique de la "santé" de la classe

#### Rapport D — Rapport comparatif entre disciplines
- Contenu : tableau croisé disciplines × indicateurs (moyenne, écart-type, % échec, % excellence)
- Visualisation : heatmap des taux de réussite
- Usage : identifier les disciplines nécessitant un plan d'action

#### Rapport E — Rapport de corrélation inter-trimestres
- Contenu : scatter plot T1 vs T2, coefficient de Pearson, analyse de la stabilité
- Usage : évaluer si les résultats sont prédictifs

#### Rapport F — Rapport comparatif inter-classes (si données multi-classes)
- Contenu : comparaison des moyennes, taux de réussite, distributions entre classes d'un même niveau
- Usage : identifier les disparités entre groupes

### 7.2 Indicateurs statistiques avancés

| Indicateur | Formule | Usage |
|---|---|---|
| Écart-type des moyennes | σ = √(Σ(xi-μ)²/N) | Mesure d'homogénéité de la classe |
| Coefficient de variation | CV = σ/μ × 100 | Homogénéité relative (comparable entre classes) |
| Médiane | Valeur centrale des moyennes triées | Plus robuste que la moyenne |
| Quartiles Q1, Q3 | 25ème et 75ème percentile | Caractériser la distribution |
| Intervalle interquartile | IQR = Q3 - Q1 | Dispersion du "milieu" de la classe |
| Coefficient d'asymétrie (skewness) | Mesure la symétrie de la distribution | Si négatif : plus d'élèves au-dessus de la moyenne |
| Corrélation de Pearson T1-T2 | r = Σ((xi-μx)(yi-μy)) / (N·σx·σy) | Prédictivité des résultats |
| Indice de Gini des notes | Mesure d'inégalité | 0 = parfaite égalité, 1 = inégalité maximale |

### 7.3 Indicateurs de performance spécifiques avec deltas

Pour chaque carte du dashboard, voici la liste complète des métriques avec leur delta :

**Métriques de tendance centrale :**
- Moyenne → delta vs T précédent(s)
- Médiane → delta vs T précédent(s)
- Mode (valeur la plus fréquente) → delta vs T précédent(s)

**Métriques de dispersion :**
- Écart-type → delta (↓ = mieux si on veut homogénéité)
- Étendue (max-min) → delta (↓ = resserrement)
- IQR → delta

**Métriques de position :**
- Q1 → delta (↑ = les plus faibles progressent)
- Q3 → delta (↑ = les meilleurs progressent)
- Min → delta (↑ = plancher relevé)
- Max → delta

**Métriques de répartition :**
- % < 8,5 → delta (↓ = mieux)
- % 8,5-10 → delta
- % ≥ 10 → delta (↑ = mieux)
- % ≥ 14 (mention Bien) → delta
- % ≥ 16 (mention Très Bien) → delta

---

## 8. Récapitulatif des composants à développer

### 8.1 Composants React

| Composant | Emplacement | Description |
|---|---|---|
| `MetricCard` | Dashboard + Fiche élève | Carte avec valeur + badge(s) delta |
| `DeltaBadge` | Intégré dans MetricCard | Badge ▲/▼ avec couleur et formatage |
| `RadarDisciplinaire` | Fiche élève | Chart.js radar élève vs classe |
| `CourbeProgression` | Fiche élève + Rapport progression | Line chart T1→T2→T3 |
| `CourbeRang` | Fiche élève + Rapport progression | Line chart rang inversé |
| `HistogrammeDistribution` | Dashboard | Bar chart distribution des moyennes |
| `ScatterCorrelation` | Dashboard avancé | Scatter T1 vs T2 |
| `HeatmapDisciplines` | Dashboard + Onglet Rapports | Carte de chaleur taux réussite |
| `AlertesBanner` | Dashboard + Fiche élève | Bandeau d'alertes colorées |
| `ProfilBadge` | Fiche élève + Liste nominative | Badge profil élève (couleur + label) |
| `TableauProgression` | Rapport progression | Tableau T1/T2/T3 avec deltas |
| `ComparatifDisciplines` | Onglet Rapports | Tableau croisé + heatmap |

### 8.2 Fonctions utilitaires (utils/reportCalculations.ts)

```typescript
// Statistiques de base
function moyenne(values: number[]): number;
function mediane(values: number[]): number;
function ecartType(values: number[]): number;
function quartiles(values: number[]): { q1: number; q2: number; q3: number };
function coefficientVariation(values: number[]): number;
function pearsonCorrelation(x: number[], y: number[]): number;

// Deltas et comparaisons
function calculateDelta(current: number, previous: number): DeltaResult;
function calculateAllDeltas(currentTrimestre: number, data: TrimestreData[]): DeltaMap;

// Alertes
function generateAlertesEleve(eleve: Eleve, trimestreActuel: number): Alerte[];
function generateAlertesDiscipline(discipline: Discipline, trimestreActuel: number): Alerte[];
function generateAlertesClasse(stats: StatsClasse, trimestreActuel: number): Alerte[];

// Profils
function classifierEleve(eleve: Eleve): ProfilEleve;
function profilDisciplinaire(notes: NotesDisciplinaireEleve[]): "litteraire" | "scientifique" | "equilibre";

// Rapports
function genererRapportProgression(eleve: Eleve): RapportProgression;
function genererRapportAlertes(classe: Classe): RapportAlertes;
function genererComparatifDisciplines(disciplines: Discipline[]): ComparatifDisciplines;
```

### 8.3 Types TypeScript

```typescript
interface DeltaResult {
  value: number;            // Valeur du delta
  direction: "up" | "down" | "stable";
  percentage: number;       // Delta en pourcentage
  reference: string;        // "T1" ou "T2"
}

interface DeltaMap {
  [metricKey: string]: DeltaResult[];
}

interface Alerte {
  code: string;             // "REG_FORTE", "SEUIL_CRITIQUE", etc.
  severite: "danger" | "warning" | "info" | "success";
  cible: string;            // Nom élève ou discipline
  message: string;
  donnees: {
    valeurActuelle: number;
    valeurPrecedente?: number;
    delta?: number;
  };
}

type ProfilEleve = "excellent_stable" | "bon_progression" | "stable_milieu" 
                 | "en_progression" | "en_decrochage" | "fragile";

interface RapportProgression {
  eleve: Eleve;
  cartes: MetricCardData[];
  courbesMoyennes: { trimestre: string; eleve: number; classe: number }[];
  courbesRangs: { trimestre: string; rang: number }[];
  tableauDetail: LigneProgression[];
  tendance: { pente: number; previsionT3?: number; volatilite: number };
  radarData?: RadarData;
  alertes: Alerte[];
  profil: ProfilEleve;
}
```

### 8.4 Ordre de développement recommandé

1. **Types et utilitaires** : `types/reports.ts` + `utils/reportCalculations.ts`
2. **Composants de base** : `MetricCard` avec `DeltaBadge`
3. **Dashboard enrichi** : intégrer les cartes avec deltas dans Vue d'ensemble
4. **Radar disciplinaire** : composant `RadarDisciplinaire` dans la fiche élève
5. **Rapport de progression** : composant complet avec courbes + tableau
6. **Système d'alertes** : règles + composant `AlertesBanner`
7. **Profilage** : fonction de classification + `ProfilBadge`
8. **Rapports avancés** : onglet Rapports avec les rapports A à F
9. **Exports** : PDF/Word pour le rapport de progression et les alertes

---

## Annexe — Commande de démarrage pour Claude Code

```
Lis les fichiers SPEC_EMSP_Dashboard.md, SPEC_Module_Rapports.md et ANALYSE_Rapports_K12.md.

Ce troisième document (ANALYSE_Rapports_K12.md) contient l'analyse complète des rapports K12 
du secondaire avec :
- Les indicateurs à construire avec leur formule
- La spécification des cartes métriques avec deltas de performance par trimestre
- Le rapport de progression individuelle
- Le diagramme radar élève vs classe
- Le système d'alertes automatiques
- Les rapports supplémentaires proposés

Commence par :
1. Ajouter les types TypeScript pour les deltas, alertes et profils
2. Implémenter les fonctions utilitaires de calcul (statistiques, deltas, alertes)
3. Créer le composant MetricCard avec DeltaBadge 
4. Enrichir le dashboard avec les deltas de performance sur chaque carte
5. Créer le composant RadarDisciplinaire pour la fiche élève
6. Implémenter le rapport de progression individuelle
7. Ajouter le système d'alertes

Les cartes métriques doivent afficher un indicateur de performance par rapport aux trimestres 
antérieurs : en T2, afficher le delta vs T1 ; en T3, afficher le delta vs T2 ET vs T1.