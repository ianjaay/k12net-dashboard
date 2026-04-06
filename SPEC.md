# K12net Dashboard — Spécifications Techniques

## 1. Vue d'ensemble

**K12net Dashboard** est un tableau de bord de conseil de classe pour les établissements scolaires du secondaire (collège et lycée) en Côte d'Ivoire. Il remplace l'ancien EMSP Dashboard (orienté enseignement supérieur) par un système adapté au modèle K12 avec :

- Gestion par **trimestre** (T1, T2, T3) au lieu de semestres
- **Distinctions et sanctions** trimestrielles
- **Promotion annuelle** (Admis / Redouble / Exclu)
- **Orientation filière** automatique pour le lycée
- Règles **configurables par année académique**

### Établissement de référence
Lycée Sainte Marie de Cocody, Abidjan

---

## 2. Modèle de données

### 2.1 Niveaux scolaires

| Code | Niveau | Cycle |
|------|--------|-------|
| `7eme` | 7ème | Collège |
| `8eme` | 8ème | Collège |
| `9eme` | 9ème | Collège |
| `10eme` | 10ème | Collège (terminal) |
| `11eme` | Seconde (11ème) | Lycée |
| `12eme` | Première (12ème) | Lycée |
| `13eme` | Terminale (13ème) | Lycée (terminal) |

**Groupes de niveaux** utilisés pour les seuils de distinction :
- `7-10` : Collège (7ème à 10ème)
- `11-13` : Lycée (Seconde à Terminale)

### 2.2 Filières (lycée uniquement)

| Code | Filière |
|------|---------|
| `A` | Littéraire (Seconde) |
| `A1` | Littéraire spécialisé |
| `A2` | Littéraire général |
| `C` | Scientifique (Maths/Physique) |
| `D` | Sciences naturelles |

### 2.3 Entités principales

- **K12Student** : Élève avec matricule, niveau, filière, statut de redoublement, notes par trimestre
- **K12Class** : Classe regroupant des élèves d'un même niveau/filière pour une année
- **SubjectMark** : Note d'une matière avec coefficient, bonus, conduite, composition française
- **TermMarks** : Notes d'un trimestre avec moyenne, compteur d'échecs, exemption
- **TermResult** : Résultat trimestriel (distinction + sanction + rang)
- **YearResult** : Résultat annuel (moyenne, promotion, filière suggérée, rang)

---

## 3. Moteur de règles

### 3.1 Architecture

Le moteur de règles est implémenté dans `src/utils/k12RulesEngine.ts`. Il est **configurable par année académique** via l'interface `K12YearRulesConfig`.

Trois configurations sont intégrées :
- **2024** : Règles les plus récentes
- **2023** : Identiques à 2024
- **2022** : Règles simplifiées

Les règles sont stockées dans Firestore dans `globalSettings` et peuvent être surchargées via l'admin.

### 3.2 Règles trimestrielles

#### Distinctions (récompenses)

Les distinctions sont attribuées si la moyenne trimestrielle atteint un certain seuil. La variante "avec réserve" (R) est attribuée si l'élève a au moins une matière non-bonus en dessous de 10/20 ou a échoué en composition de français.

| Distinction | Seuil 7-10 | Seuil 11-13 | Description |
|-------------|-----------|-----------|-------------|
| **TH** | 12.5 ≤ moy < 13 | 12 ≤ moy < 13 | Tableau d'Honneur |
| **THR** | idem + réserves | idem + réserves | Tableau d'Honneur avec Réserve |
| **THE** | 13 ≤ moy < 14 | 13 ≤ moy < 14 | Tableau d'Excellence |
| **THER** | idem + réserves | idem + réserves | Tableau d'Excellence avec Réserve |
| **THF** | moy ≥ 14 | moy ≥ 14 | Tableau de Félicitations |
| **THFR** | idem + réserves | idem + réserves | Félicitations avec Réserve |

**Condition de réserve (2023-2024)** :
- Au moins 1 matière non-bonus avec note < 10
- OU score en composition de français en dessous de la moyenne

**Condition de réserve (2022)** :
- Au moins 1 matière (toutes incluses) avec note < 10

#### Sanctions

Les sanctions sont mutuellement exclusives et évaluées par priorité :

| Sanction | Condition | Description |
|----------|-----------|-------------|
| **BTI** | Moy < 8.5 | Blâme de Travail Insuffisant |
| **AVT** | 8.5 ≤ Moy < 10 | Avertissement de Travail |
| **BMC** | Note conduite < 10 | Blâme de Mauvaise Conduite |
| **AMC** | 10 ≤ Note conduite < 11 | Avertissement de Mauvaise Conduite |

**Cas d'exemption** : Un élève sans aucune note pour le trimestre est exempté de toute distinction et sanction.

### 3.3 Règles annuelles (Promotion)

#### Niveaux standards (7ème à 12ème, hors terminaux)

| Statut | Non-redoublant | Redoublant |
|--------|---------------|-----------|
| **ADMIS** | Moy ≥ 10 | Moy ≥ 10 |
| **REDOUBLE** | 8.5 ≤ Moy < 10 | — |
| **EXCLU** | Moy < 8.5 | Moy < 10 |

#### Niveaux terminaux (10ème, Terminale)

**2023-2024** :
- Non-redoublant : Moy ≥ 8.5 → REDOUBLE, Moy < 8.5 → EXCLU
- Redoublant : automatiquement EXCLU (pas de second redoublement)

**2022** :
- Non-redoublant : Moy ≥ 8.5 → REDOUBLE, Moy < 8.5 → EXCLU
- Redoublant : Moy ≥ 8.5 → ADMIS, Moy < 8.5 → EXCLU

### 3.4 Orientation filière (lycée)

L'orientation est calculée automatiquement pour les élèves promus du lycée :

#### Transitions Seconde (11ème) → Première (12ème)

| Filière actuelle | Condition | Filière suggérée |
|-----------------|-----------|-----------------|
| C | Moy ≥ 13, Maths ≥ 14, PC ≥ 14, SVT ≥ 12 | **C** |
| C | Sinon | **D** |
| A | — | **A2** |

#### Transitions Première (12ème) → Terminale (13ème)

| Filière actuelle | Condition | Filière suggérée |
|-----------------|-----------|-----------------|
| D | Moy ≥ 10, Maths ≥ 11, PC ≥ 11, SVT ≥ 12 | **D** |
| D | Sinon | **A1** |
| A2 | Moy ≥ 12, Maths ≥ 12 | **A1** |
| A2 | Sinon | **A2** |
| C | Moy ≥ 13, Maths ≥ 13, PC ≥ 13, SVT ≥ 12 | **C** |

---

## 4. Architecture technique

### 4.1 Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| État | React Context |
| Backend | Firebase (Auth, Firestore, Storage) |
| i18n | i18next (FR/EN) |
| Charts | Recharts |
| Export | xlsx, docx, pdf |

### 4.2 Nouveau projet Firebase

L'application utilise un **nouveau projet Firebase** séparé de l'ancien EMSP Dashboard.

Variables d'environnement (`.env`) :
```
VITE_K12_FIREBASE_API_KEY=
VITE_K12_FIREBASE_AUTH_DOMAIN=
VITE_K12_FIREBASE_PROJECT_ID=
VITE_K12_FIREBASE_STORAGE_BUCKET=
VITE_K12_FIREBASE_MESSAGING_SENDER_ID=
VITE_K12_FIREBASE_APP_ID=
```

### 4.3 Structure Firestore

```
users/{uid}
  - email, displayName, role, status

globalSettings/default
  - schoolName, schoolLogo
  - defaultAcademicYear
  - yearConfigs: { "2024": K12YearRulesConfig, ... }
  - subjectCatalog: { "7eme": SubjectDefinition[], ... }

sessions/{sessionId}
  - name, description, academicYear, schoolName
  - ownerId, members, memberEmails
  - rulesConfig: K12YearRulesConfig

sessions/{sessionId}/classes/{classId}
  - className, gradeLevel, branch
  - students: K12Student[]

sessions/{sessionId}/snapshots/{snapshotId}
  - createdAt, label
  - data: { classes, rulesConfig }
```

### 4.4 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/types/k12.ts` | Types domaine K12 |
| `src/utils/k12RulesEngine.ts` | Moteur de règles (distinctions, sanctions, promotion, orientation) |
| `src/lib/firebase-k12.ts` | Configuration Firebase (nouveau projet) |
| `src/contexts/SessionContext.tsx` | À adapter pour le modèle K12 |
| `src/components/Dashboard.tsx` | À adapter pour les stats K12 |

---

## 5. Fonctionnalités

### 5.1 Import des données

- Upload de fichiers Excel contenant les notes par trimestre
- Détection automatique du niveau, de la filière, et du trimestre
- Catalogue de matières configurable par niveau

### 5.2 Calculs automatiques

- Moyenne trimestrielle pondérée par coefficients
- Attribution des distinctions et sanctions
- Moyenne annuelle (moyenne des 3 trimestres)
- Décision de promotion (ADMIS / REDOUBLE / EXCLU)
- Orientation filière automatique
- Classement avec ex-aequo

### 5.3 Dashboard

- Statistiques par classe : taux de réussite, répartition des statuts
- Statistiques par trimestre : distinctions, sanctions, moyennes
- Graphiques de distribution des notes
- Comparaison entre trimestres

### 5.4 Détail élève

- Fiche individuelle avec notes par matière et par trimestre
- Évolution trimestrielle
- Distinction/sanction par trimestre
- Décision annuelle et orientation

### 5.5 Conseil de classe

- Vue synthétique pour le conseil de classe
- Liste nominative par statut (Admis, Redouble, Exclu)
- Export PV de conseil de classe (DOCX)
- Export tableaux (Excel, PDF)

### 5.6 Administration

- Configuration des règles par année académique
- Gestion du catalogue de matières
- Gestion des utilisateurs et sessions
- Import/export de photos élèves

---

## 6. Différences avec l'ancien EMSP Dashboard

| Aspect | EMSP Dashboard | K12net Dashboard |
|--------|---------------|-----------------|
| Public | Enseignement supérieur | Collège / Lycée |
| Périodes | 2 semestres (S1/S2) | 3 trimestres (T1/T2/T3) |
| Notes | UE/ECUE avec crédits | Matières avec coefficients |
| Statuts | ADMIS/AUTORISÉ/AJOURNÉ | ADMIS/REDOUBLE/EXCLU |
| Récompenses | — | Distinctions (TH/THE/THF) |
| Sanctions | — | BTI/AVT/BMC/AMC |
| Orientation | — | Filière automatique (lycée) |
| Crédits | Système LMD | Non applicable |
| Repêchage | Oui | Non |
| Compensation | UE compensation | Non applicable |
| Base de données | Projet Firebase partagé | Nouveau projet Firebase dédié |
