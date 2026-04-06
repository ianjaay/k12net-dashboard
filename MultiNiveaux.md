# Architecture Multi-Niveaux et Multi-Années — Spécifications pour Claude Code

> Organisation hiérarchique : Ministère → DRENA → Établissement → Classe
> Chargement des données via API SDS OneRoster v1.1 (principal) + Import Excel (fallback)
> Date : 5 avril 2026 (v3 — intégration API OneRoster)

---

## Sommaire

1. Structure hiérarchique
2. Chargement des données — API OneRoster v1.1
3. Chargement des données — Import Excel (fallback)
4. Modèle de données unifié
5. Gestion multi-années scolaires
6. Indicateurs agrégés par niveau hiérarchique
7. Indicateurs de comparaison inter-années
8. Navigation et interface utilisateur
9. Architecture technique
10. Récapitulatif des composants

---

## 1. Structure hiérarchique

### 1.1 Organisation (4 niveaux)

```
MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION
│
├── DRENA (Direction Régionale)
│   │   Ex : DRENA ABIDJAN1, DRENA DIVO, DRENA BOUAKE 1
│   │
│   ├── Établissement (rattaché directement à la DRENA)
│   │   │   Ex : LYCEE SAINTE MARIE DE COCODY (Code: CI 000405)
│   │   │
│   │   ├── Classe (6eme_1, 6eme_2, 2ndeC_1, ...)
│   │   │   └── Élèves + Enseignants
```

### 1.2 Niveaux d'agrégation

| Niveau | Grain | Entité OneRoster |
|---|---|---|
| **Ministère** | National | Org (type: "national") |
| **DRENA** | Régional | Org (type: "district" ou "department") |
| **Établissement** | École/Lycée | Org (type: "school") |
| **Classe** | Salle de classe | Class |

---

## 2. Chargement des données — API OneRoster v1.1

### 2.1 Présentation de l'API

L'API SDS OneRoster v1.1 est le **mode de chargement principal** des données. Elle expose les entités suivantes via des endpoints REST :

| Entité | Endpoint | Description |
|---|---|---|
| Organisations | `/ims/oneroster/v1p1/orgs` | Hiérarchie complète (DRENA, établissements) |
| Écoles | `/ims/oneroster/v1p1/schools` | Établissements uniquement |
| Classes | `/ims/oneroster/v1p1/classes` | Salles de classe |
| Élèves | `/ims/oneroster/v1p1/students` | Élèves |
| Enseignants | `/ims/oneroster/v1p1/teachers` | Enseignants |
| Inscriptions | `/ims/oneroster/v1p1/enrollments` | Liens élève/enseignant → classe |
| Sessions | `/ims/oneroster/v1p1/academicSessions` | Années scolaires et trimestres |
| Cours | `/ims/oneroster/v1p1/courses` | Matières/disciplines |
| Notes | `/ims/oneroster/v1p1/lineItems` + `/results` | Évaluations et résultats |
| Démographie | `/ims/oneroster/v1p1/demographics` | Données démographiques élèves |

**Base URL** : `https://azure.k12net.com/INTCore.Web`
**Version** : OneRoster v1.1 (IMS Global)

### 2.2 Authentification OAuth2

L'API utilise **OAuth2 Client Credentials Grant** :

```typescript
// Étape 1 : Obtenir un token
interface OAuth2Config {
  tokenUrl: string;              // Variable {{Oauth2TokenAddress}}
  clientId: string;              // Variable {{OneRosterConsumerKey}}
  clientSecret: string;          // Variable {{OneRosterConsumerSecret}}
  scope?: string;                // Variable {{Scopes}} (optionnel)
}

async function getAccessToken(config: OAuth2Config): Promise<string> {
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...(config.scope && { scope: config.scope })
    })
  });
  
  const data = await response.json();
  return data.access_token;  // Token Bearer à utiliser sur chaque requête
}

// Étape 2 : Utiliser le token sur chaque requête
async function apiCall(endpoint: string, token: string): Promise<any> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    }
  });
  return response.json();
}
```

**Le token doit être rafraîchi** quand il expire (typiquement 1h). L'application doit gérer le renouvellement automatique.

### 2.3 Pagination

Toutes les listes supportent la pagination via `offset` et `limit` :

```
GET /schools?offset=0&limit=100&filter=status='active'
```

Le header `X-Total-Count` retourne le nombre total d'enregistrements. L'application doit boucler pour récupérer toutes les pages :

```typescript
async function fetchAllPages<T>(
  endpoint: string, 
  resultKey: string,  // "schools", "students", "classes", etc.
  token: string,
  pageSize: number = 100
): Promise<T[]> {
  let offset = 0;
  let allItems: T[] = [];
  let totalCount = Infinity;
  
  while (offset < totalCount) {
    const url = `${BASE_URL}${endpoint}?offset=${offset}&limit=${pageSize}&filter=status='active'`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    
    totalCount = parseInt(response.headers.get("X-Total-Count") || "0");
    const data = await response.json();
    const items = data[resultKey] || [];
    allItems.push(...items);
    offset += pageSize;
  }
  
  return allItems;
}
```

### 2.4 Mode Delta (synchronisation incrémentale)

Pour ne récupérer que les changements depuis la dernière synchronisation :

```
GET /schools?filter=dateLastModified>'2026-04-01T00:00:00Z'
GET /students?filter=dateLastModified>'2026-04-01T00:00:00Z'
GET /classes?filter=dateLastModified>'2026-04-01T00:00:00Z'
GET /enrollments?filter=dateLastModified>'2026-04-01T00:00:00Z'
```

L'application stocke la date de dernière synchronisation et l'utilise pour les imports suivants.

### 2.5 Entités OneRoster — Structure détaillée

#### Organisation (Org) — Hiérarchie DRENA/Établissement

```typescript
// GET /ims/oneroster/v1p1/orgs → { orgs: OneRosterOrg[] }
// GET /ims/oneroster/v1p1/schools → { schools: OneRosterOrg[] }
// GET /ims/oneroster/v1p1/schools/{id} → { school: OneRosterOrg }

interface OneRosterOrg {
  sourcedId: string;               // ID unique
  status: "active" | "tobedeleted";
  dateLastModified: string;        // ISO datetime
  name: string;                    // "LYCEE SAINTE MARIE DE COCODY"
  type: "national" | "state" | "district" | "department" | "school" | "local";
  identifier: string;              // Code établissement "CI 000405"
  parent?: {                       // Référence à l'org parente (DRENA pour un school)
    sourcedId: string;
    type: string;                  // "org"
  };
  children?: {                     // Orgs enfants
    sourcedId: string;
    type: string;
  }[];
}

// Mapping vers notre modèle :
// type "national"/"state"     → Ministère
// type "district"/"department" → DRENA
// type "school"               → Établissement
// Le champ parent.sourcedId   → drena_id (rattachement hiérarchique)
```

#### Classe (Class)

```typescript
// GET /ims/oneroster/v1p1/classes → { classes: OneRosterClass[] }
// GET /ims/oneroster/v1p1/schools/{school_id}/classes → { classes: OneRosterClass[] }
// GET /ims/oneroster/v1p1/classes/{id} → { class: OneRosterClass }

interface OneRosterClass {
  sourcedId: string;
  status: "active" | "tobedeleted";
  dateLastModified: string;
  title: string;                   // "6eme_2", "2ndeC_1"
  classCode?: string;
  classType?: string;              // "homeroom", "scheduled"
  location?: string;
  school: {                        // Référence à l'établissement
    sourcedId: string;
    type: "org";
  };
  terms: {                         // Périodes associées
    sourcedId: string;
    type: "academicSession" | "term" | "gradingPeriod" | "semester" | "schoolYear";
  }[];
  course?: {                       // Cours/matière (optionnel)
    sourcedId: string;
    type: "course";
  };
  grades?: string[];               // Niveaux ("6", "5", "2nde", etc.)
}
```

#### Élève (Student) / Enseignant (Teacher)

```typescript
// GET /ims/oneroster/v1p1/students → { students: OneRosterUser[] } ou { users: OneRosterUser[] }
// GET /ims/oneroster/v1p1/schools/{school_id}/students → { students: OneRosterUser[] }
// GET /ims/oneroster/v1p1/teachers → { teachers: OneRosterUser[] } ou { users: OneRosterUser[] }

interface OneRosterUser {
  sourcedId: string;
  status: "active" | "tobedeleted";
  dateLastModified: string;
  username: string;                // Login (sans @)
  givenName: string;               // Prénom
  familyName: string;              // Nom de famille
  middleName?: string;
  email?: string;
  phone?: string;
  role: "student" | "teacher" | "parent" | "guardian" | "aide" | "administrator";
  identifier: string;              // Matricule élève "25051252P"
  sms?: string;
  orgs: {                          // Établissements de rattachement
    sourcedId: string;
    type: "org";
  }[];
  grades?: string[];               // Niveaux ("6", "5", etc.)
  agents?: {                       // Parents/tuteurs (pour les élèves)
    sourcedId: string;
    type: "user";
  }[];
}
```

#### Inscription (Enrollment)

```typescript
// GET /ims/oneroster/v1p1/schools/{school_id}/enrollments → { enrollments: OneRosterEnrollment[] }
// Filtres : ?filter=role='student'  ou  ?filter=role='teacher'

interface OneRosterEnrollment {
  sourcedId: string;
  status: "active" | "tobedeleted";
  dateLastModified: string;
  role: "student" | "teacher";
  user: {                          // Élève ou enseignant
    sourcedId: string;
    type: "user";
  };
  class: {                         // Classe
    sourcedId: string;
    type: "class";
  };
  school: {                        // Établissement
    sourcedId: string;
    type: "org" | "school" | "department" | "district" | "local" | "state" | "national";
  };
  primary?: boolean;               // Inscription principale ?
  beginDate?: string;
  endDate?: string;
}
```

#### Session académique (AcademicSession / Term)

```typescript
// GET /ims/oneroster/v1p1/academicSessions → { academicSessions: OneRosterSession[] }
// GET /ims/oneroster/v1p1/terms/{id} → { term: OneRosterSession }

interface OneRosterSession {
  sourcedId: string;
  status: "active" | "tobedeleted";
  dateLastModified: string;
  title: string;                   // "2025-2026" ou "Trimestre 1"
  type: "schoolYear" | "term" | "gradingPeriod" | "semester";
  startDate: string;               // "2025-09-01"
  endDate: string;                 // "2026-07-31"
  schoolYear: string;              // "2026" (année de fin)
  parent?: {                       // Pour un trimestre : référence à l'année scolaire
    sourcedId: string;
    type: "academicSession";
  };
  children?: {                     // Pour une année : liste des trimestres
    sourcedId: string;
    type: "academicSession";
  }[];
}

// Mapping vers notre modèle :
// type "schoolYear" → AnneeScolaire
// type "term"/"gradingPeriod"/"semester" → Trimestre (T1, T2, T3)
```

#### Notes et évaluations (LineItem + Result) — GradeSync

```typescript
// GET /ims/oneroster/v1p1/classes/{class_id}/lineItems → Évaluations de la classe
// GET /ims/oneroster/v1p1/classes/{class_id}/students/{student_id}/results → Notes d'un élève

interface OneRosterLineItem {
  sourcedId: string;
  title: string;                   // "Contrôle Maths T2"
  description?: string;
  assignDate: string;
  dueDate: string;
  resultValueMin: number;          // 0
  resultValueMax: number;          // 20 (ou 100)
  class: { sourcedId: string; type: "class" };
  gradingPeriod: { sourcedId: string; type: "academicSession" };
  category?: { sourcedId: string; type: "category" };
}

interface OneRosterResult {
  sourcedId: string;
  score: number;                   // Note de l'élève
  scoreDate: string;
  scoreStatus: "exempt" | "fully graded" | "not submitted" | "partially graded";
  lineItem: { sourcedId: string };
  student: { sourcedId: string };
}
```

### 2.6 Flux de synchronisation complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                 SYNCHRONISATION INITIALE (Full Sync)                │
│                                                                     │
│  Étape 1 : Authentification OAuth2                                  │
│  POST {{tokenUrl}} → access_token                                   │
│                                                                     │
│  Étape 2 : Récupérer la hiérarchie                                  │
│  GET /orgs?filter=status='active' → DRENA + Établissements          │
│  → Construire l'arbre via les champs parent/children                │
│                                                                     │
│  Étape 3 : Récupérer les sessions académiques                       │
│  GET /academicSessions → Années scolaires + Trimestres              │
│                                                                     │
│  Étape 4 : Pour chaque établissement (school)                       │
│  GET /schools/{id}/classes → Classes de l'établissement             │
│  GET /schools/{id}/students → Élèves de l'établissement            │
│  GET /schools/{id}/teachers → Enseignants                           │
│  GET /schools/{id}/enrollments?filter=role='student' → Inscriptions │
│  GET /schools/{id}/enrollments?filter=role='teacher' → Affectations │
│                                                                     │
│  Étape 5 (optionnel — si GradeSync activé) :                       │
│  GET /classes/{id}/lineItems → Évaluations                          │
│  GET /classes/{id}/lineItems/{id}/results → Notes                   │
│                                                                     │
│  Étape 6 : Stocker + calculer les indicateurs                       │
│  Sauvegarder la date de synchronisation                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                 SYNCHRONISATION DELTA (Incrémentale)                 │
│                                                                     │
│  Mêmes étapes mais avec le filtre :                                 │
│  ?filter=dateLastModified>'{{derniere_synchro}}'                    │
│                                                                     │
│  Ne récupère que les enregistrements modifiés depuis la dernière    │
│  synchronisation. Les enregistrements avec status='tobedeleted'     │
│  sont supprimés localement.                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.7 Mapping OneRoster → Modèle application

| Entité OneRoster | Champ OneRoster | → Champ Application |
|---|---|---|
| **Org (district)** | sourcedId | DRENA.id |
| | name | DRENA.nom |
| | identifier | DRENA.code |
| **Org (school)** | sourcedId | Etablissement.id |
| | name | Etablissement.nom |
| | identifier | Etablissement.code (ex: "CI 000405") |
| | parent.sourcedId | Etablissement.drena_id |
| **Class** | sourcedId | Classe.id |
| | title | Classe.nom (ex: "6eme_2") |
| | school.sourcedId | Classe.etablissement_id |
| | terms[0].sourcedId | Classe.annee_scolaire (via lookup) |
| **User (student)** | sourcedId | Eleve.id |
| | identifier | Eleve.matricule |
| | familyName | Eleve.nom |
| | givenName | Eleve.prenom |
| | email | Eleve.email |
| | orgs[0].sourcedId | → lookup établissement |
| **Enrollment** | user.sourcedId | → Eleve.id ou Enseignant.id |
| | class.sourcedId | → Classe.id |
| | role | "student" ou "teacher" |
| **AcademicSession** | sourcedId | AnneeScolaire.id ou Trimestre.id |
| | title | AnneeScolaire.libelle |
| | type | "schoolYear" → année, "term" → trimestre |
| | startDate / endDate | AnneeScolaire.debut / fin |
| | schoolYear | Année de référence |

### 2.8 Configuration de la connexion API

L'application doit fournir un écran de configuration dans l'onglet Admin :

```typescript
interface OneRosterApiConfig {
  // Connexion
  baseUrl: string;                 // "https://azure.k12net.com/INTCore.Web"
  tokenUrl: string;                // URL d'obtention du token
  clientId: string;
  clientSecret: string;            // Stocké de manière sécurisée
  scope?: string;
  
  // Synchronisation
  syncMode: "full" | "delta";
  lastSyncDate?: string;           // ISO datetime de la dernière sync
  autoSyncEnabled: boolean;        // Synchronisation automatique ?
  autoSyncInterval?: number;       // Intervalle en heures (ex: 24)
  
  // Filtres
  schoolYearFilter?: string;       // Filtrer sur une année scolaire spécifique
  activeOnly: boolean;             // Ne récupérer que les enregistrements actifs
}
```

---

## 3. Chargement des données — Import Excel (fallback)

L'import Excel reste disponible comme **méthode alternative** pour les établissements non connectés à l'API OneRoster.

### 3.1 Fichier établissements (`liste_des_etablissment.xlsx`)

Import centralisé au niveau admin. Colonnes principales :

| Colonne | Champ | Exemple |
|---|---|---|
| `Zone` | DRENA | "DRENA ABIDJAN1" |
| `School ID` | Code étab. | "CI 071358" |
| `School Name En` | Nom | "COLLEGE MODERNE HERMANKONO" |
| `Coordinates` | GPS | "5,933257;-5,017172" |
| `Number of Teachers` | Nb enseignants | 15 |
| `Principal Name` | Chef d'étab. | "FLAN Née SOUMAHORO..." |
| `Principal Email` | Email chef | "mahanf@men.edu.ci" |
| `07***` à `13***` | Nb classes par niveau | 3, 2, 1... |
| `07*** .` à `13*** .` | Effectifs par niveau | 332, 247... |

### 3.2 Fichier élèves (`listes_eleves.xlsx`)

Import par établissement/année. Colonnes principales :

| Colonne | Champ | Exemple |
|---|---|---|
| `Numéro Matricule de l'élève` | Matricule | "25051252P" |
| `Nom de famille de l'élève` | Nom | "YANLA" |
| `Prénom de l'élève` | Prénom | "LYNN MARIE EMMANUELLE" |
| `Date de naissance de l'élève` | Date naiss. | 2014-04-24 |
| `Sexe de l'élève` | Sexe | "Féminin" |
| `Niveau scolaire` | Niveau | "Sixième" |
| `Série` | Série | "C", "D", "A1" |
| `Salle de classe` | Classe | "6eme_2" |
| `LV2` | LV2 | "L.V.2 (Espagnol)" |
| `Qualité` | Redoublant | "Non Redoublant" |
| `Statut Internat` | Internat | "Externe" |
| Colonnes père/mère | Parents | Nom, prénom, tél, email |

### 3.3 Rapports trimestriels (PDF)

Les 7 rapports PDF (PV, Liste Nominative, etc.) restent nécessaires pour les **résultats et moyennes** qui ne sont pas forcément disponibles via l'API OneRoster.

---

## 4. Modèle de données unifié

Le modèle unifié fonctionne avec les deux sources (API ou Excel).

```typescript
// ─── DRENA ───
interface DRENA {
  id: string;                      // sourcedId OneRoster ou ID généré
  code: string;
  nom: string;
  source: "api" | "excel" | "manual";  // Traçabilité de l'origine
  etablissements: Etablissement[];
}

// ─── Établissement ───
interface Etablissement {
  id: string;
  code: string;                    // "CI 000405"
  nom: string;
  drena_id: string;
  source: "api" | "excel" | "manual";
  
  // Données supplémentaires (Excel ou API étendu)
  coordonnees?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  nb_enseignants?: number;
  chef_etablissement?: {
    nom: string;
    matricule?: string;
    telephone?: string;
    email?: string;
  };
  
  annees_scolaires: AnneeScolaireData[];
}

// ─── Classe ───
interface Classe {
  id: string;
  nom: string;                     // "6eme_2"
  niveau: string;
  serie?: string;
  etablissement_id: string;
  annee_scolaire: string;
  term_ids?: string[];             // Références aux sessions académiques OneRoster
  professeur_principal?: string;
  educateur?: string;
  eleves: Eleve[];
}

// ─── Élève ───
interface Eleve {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  date_naissance?: string;
  sexe: string;
  nationalite?: string;
  email?: string;
  
  // Scolarité
  niveau_scolaire: string;
  serie?: string;
  salle_de_classe: string;
  lv2?: string;
  qualite?: string;                // "Redoublant" / "Non Redoublant"
  statut_internat?: string;
  
  // Parents (depuis Excel ou agents[] OneRoster)
  pere?: ParentInfo;
  mere?: ParentInfo;
  
  // Résultats (depuis rapports PDF ou GradeSync)
  resultats: ResultatTrimestre[];
  source: "api" | "excel";
}

interface ParentInfo {
  nom: string;
  prenom: string;
  telephone?: string;
  email?: string;
}

// ─── Année scolaire ───
interface AnneeScolaire {
  id: string;
  libelle: string;                 // "2025-2026"
  debut: string;
  fin: string;
  school_year?: string;            // "2026" (format OneRoster)
  active: boolean;
  trimestres: Trimestre[];
}

interface Trimestre {
  id: string;
  numero: 1 | 2 | 3;
  titre: string;                   // "Trimestre 1", "Deuxième Trimestre"
  debut: string;
  fin: string;
  parent_annee_id: string;
}

// ─── Synchronisation ───
interface SyncLog {
  id: string;
  date: string;
  type: "full" | "delta";
  source: "api" | "excel";
  entites_synchronisees: {
    orgs: number;
    schools: number;
    classes: number;
    students: number;
    teachers: number;
    enrollments: number;
  };
  statut: "succes" | "partiel" | "erreur";
  erreurs?: string[];
  duree_ms: number;
}
```

---

## 5. Gestion multi-années scolaires

### 5.1 Détection des années via l'API

L'API renvoie les sessions académiques avec leur type. Le filtre `schoolYear` permet de cibler une année :

```
GET /academicSessions?filter=schoolYear='2026' AND status='active'
```

Les sessions de type `schoolYear` représentent les années scolaires. Les sessions de type `term`/`gradingPeriod`/`semester` avec un `parent` pointant vers un `schoolYear` représentent les trimestres.

### 5.2 Sélecteur d'année

Le sélecteur global propose les années disponibles (depuis l'API ou les imports). Changer d'année déclenche soit un rechargement API filtré, soit un switch dans les données locales.

---

## 6. Indicateurs agrégés par niveau hiérarchique

(Identique à la v2 — les indicateurs ne changent pas, seule la source de données change)

### 6.1 Fonction d'agrégation générique

```typescript
function agreger(enfants: { nom: string; effectif: number; moyenne: number; 
  nb_reussite: number; nb_excellence: number; nb_echec: number; 
  nb_felicitations: number }[]): AggregationResult;

// Réutilisable : classes→étab, étab→DRENA, DRENA→ministère
```

### 6.2 Par niveau

**Établissement** : moyenne pondérée, médiane, écart-type, taux réussite/excellence/échec, disciplines critiques, ratios enseignants, taux redoublement, tous avec deltas vs T précédent et vs N-1.

**DRENA** : agrégation des établissements + classement, écart-type inter-établissements, CV, top/bottom 5, disciplines problématiques communes, rang national.

**Ministère** : agrégation des DRENA + classement, top/bottom 20 établissements, indice de Gini, disciplines critiques nationales.

---

## 7. Indicateurs de comparaison inter-années

### 7.1 Logique de delta

```
1 seule année  → pas de delta annuel
2 années        → "vs N-1 : ▲/▼ {delta}"
3+ années       → "vs N-1" + "vs N-2" + sparkline tendance
```

### 7.2 Par niveau

Mêmes indicateurs que la v2 : delta moyenne, delta taux, tendance multi-années, convergence, mobilité classement, établissements/DRENA en progression/décrochage continu.

---

## 8. Navigation et interface utilisateur

### 8.1 Breadcrumb

```
Ministère > DRENA Abidjan 1 > Lycée Sainte Marie > 6ème_2
```

### 8.2 Onglets adaptatifs

**Ministère** : Vue d'ensemble | DRENA | Comparaison | Administration
**DRENA** : Vue d'ensemble | Établissements | Comparaison
**Établissement** : Vue d'ensemble | Classes | Élèves | Rapports | Comparaison
**Classe** : Vue d'ensemble | Élèves | Résultats/PV | Rapports

### 8.3 Administration — Chargement des données multi-niveaux

L'onglet Admin (niveau Ministère) propose **deux modes de chargement** exclusifs. L'utilisateur choisit son mode au début, puis suit un assistant guidé.

#### Vue d'ensemble de l'Admin

```
Administration
├── Chargement des données
│   ├── [Mode 1] Import via fichier Excel
│   └── [Mode 2] Import via Web Service (API OneRoster)
├── Gestion des DRENA
├── Gestion des années scolaires
└── Journal des imports / synchronisations
```

#### Mode 1 — Import via fichier Excel

Assistant en 3 étapes :

```
┌─────────────────────────────────────────────────────────────────────┐
│  IMPORT VIA FICHIER EXCEL                                           │
│                                                                     │
│  Étape 1/3 — Année scolaire                                        │
│  ┌─────────────────────────────────────────┐                        │
│  │ Sélectionner l'année scolaire :         │                        │
│  │ [2025-2026 ▼]  ou  [+ Créer nouvelle]   │                        │
│  └─────────────────────────────────────────┘                        │
│                                          [Suivant →]                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Étape 2/3 — Établissements                                        │
│  ┌─────────────────────────────────────────┐                        │
│  │ Importer le fichier établissements :    │                        │
│  │ [📄 Glisser ou cliquer pour charger]    │                        │
│  │ liste_des_etablissment.xlsx             │                        │
│  └─────────────────────────────────────────┘                        │
│  Prévisualisation : 73 établissements dans 19 DRENA détectées       │
│                                          [← Retour] [Suivant →]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Étape 3/3 — Élèves                                                │
│  ┌─────────────────────────────────────────┐                        │
│  │ Sélectionner l'établissement :          │                        │
│  │ [LYCEE SAINTE MARIE DE COCODY ▼]       │                        │
│  │                                         │                        │
│  │ Importer le fichier élèves :            │                        │
│  │ [📄 Glisser ou cliquer pour charger]    │                        │
│  │ listes_eleves.xlsx                      │                        │
│  └─────────────────────────────────────────┘                        │
│  Prévisualisation : 1285 élèves dans 28 classes détectées           │
│                                          [← Retour] [Importer]     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Mode 2 — Import via Web Service (API OneRoster)

Assistant en 4 étapes :

```
┌─────────────────────────────────────────────────────────────────────┐
│  IMPORT VIA WEB SERVICE                                             │
│                                                                     │
│  Étape 1/4 — Configuration de la connexion                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ URL du service    : [https://azure.k12net.com/INTCore.Web ] │    │
│  │ URL du token      : [https://azure.k12net.com/...token    ] │    │
│  │ Client ID         : [****************************         ] │    │
│  │ Client Secret     : [****************************         ] │    │
│  │ Scope (optionnel) : [api1                                 ] │    │
│  │                                                             │    │
│  │ [🔌 Tester la connexion]                                    │    │
│  │ ✅ Connexion réussie — Token obtenu (expire dans 59 min)    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                          [Suivant →]                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Étape 2/4 — Sélection des organisations et établissements          │
│                                                                     │
│  Le système a récupéré les organisations depuis l'API.              │
│  Cochez les DRENA et établissements à importer :                    │
│                                                                     │
│  ☑ [Tout sélectionner / Tout désélectionner]                        │
│                                                                     │
│  ▼ ☑ DRENA ABIDJAN1 (13 établissements)                            │
│      ☑ LYCEE SAINTE MARIE DE COCODY (CI 000405)                    │
│      ☑ LYCEE MODERNE NAGUY ABROGOUA 1 (XX003)                      │
│      ☑ LYCEE CLASSIQUE D'ABIDJAN (CI 000123)                       │
│      ☐ COLLEGE MODERNE ANGRE (CI 000456)  ← désélectionné          │
│      ... (10 autres)                                                │
│                                                                     │
│  ▼ ☑ DRENA ABIDJAN2 (9 établissements)                             │
│      ☑ LYCEE MODERNE AMAGOU VICTOR MARCORY (CI 411)                │
│      ☑ ...                                                          │
│                                                                     │
│  ▶ ☑ DRENA BOUAKE 1 (5 établissements)  ← replié                   │
│  ▶ ☐ DRENA BOUNDIALI (4 établissements) ← DRENA entière décochée   │
│  ▶ ☑ DRENA DIVO (1 établissement)                                   │
│  ...                                                                │
│                                                                     │
│  Sélection : 58 établissements dans 16 DRENA                       │
│                                          [← Retour] [Suivant →]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Étape 3/4 — Sélection des années scolaires                        │
│                                                                     │
│  Le système a récupéré les sessions académiques depuis l'API.       │
│  Sélectionnez les années à importer :                               │
│                                                                     │
│  ☑ 2025-2026 (en cours)                                             │
│     Trimestres : T1 (sept-déc), T2 (jan-mars), T3 (avr-juin)       │
│  ☐ 2024-2025                                                        │
│  ☐ 2023-2024                                                        │
│                                                                     │
│                                          [← Retour] [Suivant →]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Étape 4/4 — Lancement de l'import                                  │
│                                                                     │
│  Récapitulatif :                                                    │
│  • 16 DRENA, 58 établissements sélectionnés                         │
│  • Année scolaire : 2025-2026                                       │
│  • Données à importer : classes, élèves, enseignants, inscriptions  │
│                                                                     │
│  [▶ Démarrer l'import]                                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Import en cours...                                          │    │
│  │ ████████████████░░░░░░░░░░░░░░░░  42%                      │    │
│  │                                                             │    │
│  │ ✅ DRENA ABIDJAN1 — 13 établissements chargés               │    │
│  │ ✅ DRENA ABIDJAN2 — 9 établissements chargés                │    │
│  │ 🔄 DRENA ABIDJAN3 — Chargement des élèves (234/1200)       │    │
│  │ ⏳ DRENA ABIDJAN4 — En attente                               │    │
│  │ ⏳ DRENA BOUAKE 1 — En attente                               │    │
│  │ ...                                                          │    │
│  │                                                             │    │
│  │ Établissement en cours : COLLEGE MODERNE COCODY             │    │
│  │   Classes : 24 récupérées                                    │    │
│  │   Élèves : 234 / 1200 récupérés                             │    │
│  │   Enseignants : 45 récupérés                                 │    │
│  │   Inscriptions : 312 / 2400 récupérées                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [Annuler]                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

#### Logique du Mode 2 — Détail technique

```typescript
// Étape 1 : Tester la connexion
async function testConnection(config: OneRosterApiConfig): Promise<{
  success: boolean;
  tokenExpiry?: Date;
  error?: string;
}>;

// Étape 2 : Récupérer et afficher les organisations
interface OrgSelectionTree {
  drenas: {
    org: OneRosterOrg;
    selected: boolean;
    etablissements: {
      org: OneRosterOrg;
      selected: boolean;
    }[];
  }[];
}

async function loadOrgTree(service: OneRosterService): Promise<OrgSelectionTree> {
  const orgs = await service.getOrgs();
  
  // Séparer DRENA (type district/department) et Établissements (type school)
  const drenas = orgs.filter(o => ["district", "department"].includes(o.type));
  const schools = orgs.filter(o => o.type === "school");
  
  // Construire l'arbre via parent.sourcedId
  return {
    drenas: drenas.map(d => ({
      org: d,
      selected: true,  // Tout sélectionné par défaut
      etablissements: schools
        .filter(s => s.parent?.sourcedId === d.sourcedId)
        .map(s => ({ org: s, selected: true }))
    }))
  };
}

// Comportement des checkboxes :
// - Cocher/décocher une DRENA → coche/décoche tous ses établissements
// - Décocher un établissement → la DRENA passe en état "indéterminé" (-)
// - Bouton "Tout sélectionner" / "Tout désélectionner" en haut

// Étape 3 : Récupérer les sessions académiques
async function loadAcademicSessions(service: OneRosterService): Promise<{
  annees: {
    session: OneRosterSession;
    selected: boolean;
    trimestres: OneRosterSession[];
  }[];
}> {
  const sessions = await service.getAcademicSessions();
  
  const annees = sessions.filter(s => s.type === "schoolYear");
  const trimestres = sessions.filter(s => ["term", "gradingPeriod", "semester"].includes(s.type));
  
  return {
    annees: annees.map(a => ({
      session: a,
      selected: false,
      trimestres: trimestres.filter(t => t.parent?.sourcedId === a.sourcedId)
    }))
  };
}

// Étape 4 : Lancer l'import
interface ImportProgress {
  total_drenas: number;
  drenas_termines: number;
  drena_en_cours: string;
  
  total_etablissements: number;
  etablissements_termines: number;
  etablissement_en_cours: string;
  
  classes_importees: number;
  eleves_importes: number;
  eleves_total_estime: number;     // Depuis X-Total-Count
  enseignants_importes: number;
  inscriptions_importees: number;
  
  pourcentage: number;
  statut: "en_cours" | "termine" | "erreur";
  erreurs: string[];
}

async function executeImport(
  service: OneRosterService,
  selectedOrgs: OrgSelectionTree,
  selectedSessions: string[],     // sourcedIds des années sélectionnées
  onProgress: (progress: ImportProgress) => void
): Promise<SyncLog> {
  
  const selectedSchoolIds = selectedOrgs.drenas
    .flatMap(d => d.etablissements)
    .filter(e => e.selected)
    .map(e => e.org.sourcedId);
  
  for (const schoolId of selectedSchoolIds) {
    // 1. Récupérer les classes de cet établissement
    const classes = await service.getClassesBySchool(schoolId);
    onProgress({ /* mise à jour */ });
    
    // 2. Récupérer les élèves
    const students = await service.getStudentsBySchool(schoolId);
    onProgress({ /* mise à jour */ });
    
    // 3. Récupérer les enseignants
    const teachers = await service.getTeachersBySchool(schoolId);
    onProgress({ /* mise à jour */ });
    
    // 4. Récupérer les inscriptions (élèves → classes)
    const enrollments = await service.getEnrollmentsBySchool(schoolId);
    onProgress({ /* mise à jour */ });
    
    // 5. Mapper et stocker dans IndexedDB
    await storeImportedData(schoolId, classes, students, teachers, enrollments);
  }
}
```

#### Composants React pour l'Admin

```typescript
// Composant principal
interface ImportWizardProps {
  mode: "excel" | "api";
}

// Mode Excel
// Étape 1 : AnneeSelector
// Étape 2 : FileUploadEtablissements (drag & drop + prévisualisation)
// Étape 3 : EtablissementSelector + FileUploadEleves

// Mode API
// Étape 1 : ApiConfigForm (URL, credentials, bouton test)
// Étape 2 : OrgSelectionTree (arbre DRENA/étab. avec checkboxes)
// Étape 3 : AcademicSessionSelector (liste des années avec trimestres)
// Étape 4 : ImportSummaryAndLaunch (récapitulatif + barre de progression)

// Composants partagés
// StepIndicator : indicateur d'étape (1/3 ou 1/4)
// ProgressBar : barre de progression avec détail par DRENA
// ImportLog : journal d'import en temps réel
```

```
src/components/admin/
├── ImportWizard.tsx                 # Conteneur principal avec switch mode
├── ModeSelector.tsx                 # Choix Excel ou API
├── steps/
│   ├── excel/
│   │   ├── Step1_AnneeSelection.tsx
│   │   ├── Step2_FileEtablissements.tsx
│   │   └── Step3_FileEleves.tsx
│   └── api/
│       ├── Step1_ApiConfig.tsx       # URL, credentials, test connexion
│       ├── Step2_OrgSelection.tsx    # Arbre avec checkboxes DRENA/étab.
│       ├── Step3_SessionSelection.tsx # Années scolaires
│       └── Step4_ImportLaunch.tsx     # Récapitulatif + progression
├── shared/
│   ├── StepIndicator.tsx
│   ├── ProgressBar.tsx
│   ├── ImportLogViewer.tsx
│   └── OrgTreeCheckbox.tsx          # Composant arbre avec checkboxes
└── DRENAManager.tsx                 # Gestion manuelle des DRENA
```

### 8.4 Indicateur de source des données

Chaque entité affiche un badge discret indiquant sa source :
- Badge "API" (synchronisé via OneRoster)
- Badge "Excel" (importé manuellement)
- Badge "Manuel" (saisi manuellement)

---

## 9. Architecture technique

### 9.1 Service API OneRoster

```typescript
class OneRosterService {
  private config: OneRosterApiConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  
  constructor(config: OneRosterApiConfig) {
    this.config = config;
  }
  
  // Authentification avec renouvellement auto
  private async ensureToken(): Promise<string>;
  
  // Récupération paginée générique
  private async fetchAll<T>(endpoint: string, key: string): Promise<T[]>;
  
  // Endpoints principaux
  async getOrgs(): Promise<OneRosterOrg[]>;
  async getSchools(): Promise<OneRosterOrg[]>;
  async getSchoolById(id: string): Promise<OneRosterOrg>;
  async getClassesBySchool(schoolId: string): Promise<OneRosterClass[]>;
  async getStudentsBySchool(schoolId: string): Promise<OneRosterUser[]>;
  async getTeachersBySchool(schoolId: string): Promise<OneRosterUser[]>;
  async getEnrollmentsBySchool(schoolId: string, role?: "student" | "teacher"): Promise<OneRosterEnrollment[]>;
  async getAcademicSessions(): Promise<OneRosterSession[]>;
  async getCourses(): Promise<any[]>;
  async getDemographics(): Promise<any[]>;
  
  // GradeSync
  async getLineItemsByClass(classId: string): Promise<OneRosterLineItem[]>;
  async getResultsByClassAndStudent(classId: string, studentId: string): Promise<OneRosterResult[]>;
  
  // Delta
  async getSchoolsDelta(since: string): Promise<OneRosterOrg[]>;
  async getStudentsDelta(since: string): Promise<OneRosterUser[]>;
  async getClassesDelta(since: string): Promise<OneRosterClass[]>;
  async getEnrollmentsDelta(schoolId: string, since: string): Promise<OneRosterEnrollment[]>;
  
  // Sync orchestrée
  async fullSync(): Promise<SyncLog>;
  async deltaSync(): Promise<SyncLog>;
}
```

### 9.2 Stockage (identique v2)

IndexedDB via Dexie.js pour la phase 1. Migration PostgreSQL pour la phase 2.

```typescript
db.version(2).stores({
  // Référentiel
  api_config: "id",
  sync_logs: "id, date, type, statut",
  annees_scolaires: "id, libelle, active",
  drenas: "id, code, nom",
  etablissements: "id, code, nom, drena_id",
  
  // Données par année
  classes: "id, nom, etablissement_id, annee_scolaire",
  eleves: "id, matricule, nom, classe_id, annee_scolaire",
  enseignants: "id, matricule, nom, etablissement_id",
  enrollments: "id, user_id, class_id, role",
  resultats_trimestre: "id, eleve_id, trimestre, annee_scolaire",
  notes_discipline: "id, eleve_id, trimestre, discipline",
  stats_classe: "id, classe_id, trimestre, annee_scolaire",
  
  // Imports
  imports: "id, date, type_import, etablissement_id"
});
```

---

## 10. Commande de démarrage Claude Code

```
Lis les fichiers SPEC_EMSP_Dashboard.md, SPEC_Module_Rapports.md, 
ANALYSE_Rapports_K12.md et SPEC_Multi_Niveaux.md.

SPEC_Multi_Niveaux.md (v3) définit :
- Hiérarchie 4 niveaux : Ministère → DRENA → Établissement → Classe
- DEUX MODES DE CHARGEMENT dans l'Admin, via un assistant guidé :

  MODE 1 — Import Excel (3 étapes) :
    Étape 1 : Sélectionner/créer l'année scolaire
    Étape 2 : Importer le fichier établissements (.xlsx) → crée DRENA + écoles
    Étape 3 : Sélectionner un établissement + importer le fichier élèves (.xlsx)

  MODE 2 — Import via Web Service API OneRoster (4 étapes) :
    Étape 1 : Configurer la connexion (URL, Client ID, Secret) + tester
    Étape 2 : L'API renvoie les orgs → afficher un arbre avec checkboxes
              DRENA (parent) > Établissements (enfants)
              L'utilisateur coche/décoche les DRENA et établissements voulus
              Cocher une DRENA = cocher tous ses établissements
    Étape 3 : L'API renvoie les academicSessions → l'utilisateur sélectionne 
              les années scolaires à importer
    Étape 4 : Récapitulatif + lancement de l'import avec barre de progression
              Pour chaque établissement sélectionné : récupérer classes, 
              élèves, enseignants, inscriptions via l'API

Commence par :
1. Types TypeScript : OneRoster + modèle unifié + mapping
2. Service OneRosterService (auth OAuth2, pagination, tous endpoints)
3. Composant ImportWizard avec ModeSelector (Excel vs API)
4. Mode API — Step1_ApiConfig (formulaire + test connexion)
5. Mode API — Step2_OrgSelection (arbre checkboxes DRENA/établissements)
6. Mode API — Step3_SessionSelection (années scolaires)
7. Mode API — Step4_ImportLaunch (récapitulatif + progression temps réel)
8. Mode Excel — les 3 étapes (année, fichier étab., fichier élèves)
9. Stockage IndexedDB + journal de synchronisation
10. Navigation breadcrumb + dashboards par niveau
```