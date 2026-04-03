// ─── Course Structure (from Section List Report) ────────────────────────────

export interface ECUEInfo {
  code: string;
  name: string;
  credits: number;
  ueCode: string;
  homerooms: string[];  // homerooms where this ECUE appears
}

export interface UEInfo {
  code: string;
  name: string;
  totalCredits: number;
  ecueCodes: string[];
  homerooms: string[];  // homerooms where this UE appears
}

export interface CourseStructure {
  ues: Record<string, UEInfo>;
  ecues: Record<string, ECUEInfo>;
  orderedUeCodes: string[]; // ordered by appearance in semester
}

// ─── Raw Parse (from Grade Distribution Report) ──────────────────────────────

export interface RawGrade {
  ccc: number | null;
  ets: number | null;   // resultante (S2 if present, else S1)
  session1: number | null;
  session2: number | null;
  fileAvg: number | null; // Score Average from file
  approved: boolean;       // false if value was prefixed with *
  approvalFlags: {
    ccc: boolean;
    ets: boolean;
    session1: boolean;
    session2: boolean;
    fileAvg: boolean;
  };
}

export interface RawStudentRow {
  rank: number;
  matricule: string;
  name: string;
  grades: RawGrade[];      // one per ECUE in file order
  fileAverage: number | null;
  fileTotal: number | null;
  fileRank: string | null;
  isExAequo: boolean;
}

export interface ECUEColumn {
  colIndex: number;         // 0-based column in raw sheet
  rawName: string;          // e.g. "ANGLAIS GENERAL 1 L1/A-GROUPE 1"
  normalizedName: string;   // uppercase, stripped of group suffix
  rawUeName: string;        // UE name from row 5
  detectedTerm: 'S1' | 'S2' | null; // detected from ECUE name suffix (e.g. "- S2")
}

export interface ParsedExcel {
  groupName: string;
  semester: string;
  date: string;
  level: string;
  ecueColumns: ECUEColumn[];
  studentRows: RawStudentRow[];
  availableTerms: ('S1' | 'S2')[];  // terms detected in this sheet
}

// ─── Calculated Results ───────────────────────────────────────────────────────

export interface StudentECUEResult {
  ecueCode: string;
  ecueName: string;
  credits: number;
  ccc: number | null;
  ets: number | null;
  session1: number | null;
  session2: number | null;
  fileAvg: number | null;
  average: number | null;  // computed: fileAvg if available, else 0.4*CCC+0.6*ETS
  validated: boolean;       // average >= 10
  approved: boolean;
  approvalFlags: {
    ccc: boolean;
    ets: boolean;
    session1: boolean;
    session2: boolean;
    fileAvg: boolean;
  };
}

export interface StudentUEResult {
  ueCode: string;
  ueName: string;
  totalCredits: number;
  creditsEarned: number;
  average: number;
  validated: boolean;
  compensated: boolean;  // validated by compensation (UE avg>=10 but some ECUE<10)
  ecueResults: StudentECUEResult[];
}

export type StudentStatus = 'ADMIS' | 'AUTORISÉ' | 'AJOURNÉ';
export type Session = 'S1' | 'SR';

export interface Student {
  rank: number;
  matricule: string;
  name: string;
  isExAequo: boolean;
  fileAverage: number | null;
  fileRank: string | null;
  ueResults: StudentUEResult[];
  totalCredits: number;
  semesterAverage: number;
  status: StudentStatus;
  session: Session;
  eligibleRepechage: boolean;
  repechageUECode: string | null; // UE that could benefit from repêchage
  repechageUEAvg: number | null;
  // Per-term averages (populated in annual view)
  s1Average?: number | null;
  s2Average?: number | null;
}

// ─── Multi-Class Support ─────────────────────────────────────────────────────

export interface ClassInfo {
  sheetName: string;        // raw Excel sheet name, e.g. "L1-A-GROUPE 1"
  groupName: string;        // from header (e.g. "EMSP L1 A-GROUPE 1")
  niveau: string;           // L1, L2, L3, M1, M2
  filiere: string;          // EMSP, INFO, DSER, FDIG, etc.
  semester: string;
  date: string;
  level: string;
  parsedExcel: ParsedExcel;
  students: Student[];
}

export interface MultiClassData {
  courses: CourseStructure;
  classes: ClassInfo[];
  classPairs: ClassPair[];  // S1+S2 paired classes for annual view
  allNiveaux: string[];     // unique sorted levels
  allFilieres: string[];    // unique sorted programs
}

// ─── Semester / Annual View ─────────────────────────────────────────────────

export type SemesterView = 'S1' | 'S2' | 'ANNUAL';

export interface AnnualStudent {
  matricule: string;
  name: string;
  isExAequo: boolean;
  s1: Student | null;
  s2: Student | null;
  annualAverage: number;
  totalCreditsS1: number;
  totalCreditsS2: number;
  maxCreditsS1: number;
  maxCreditsS2: number;
  totalCreditsAnnual: number;
  maxCreditsAnnual: number;
  annualStatus: StudentStatus;
  rank: number;
}

export interface ClassPair {
  groupName: string;
  niveau: string;
  filiere: string;
  s1: ClassInfo | null;
  s2: ClassInfo | null;
  annualStudents: AnnualStudent[];
}

// ─── Credit Overrides ───────────────────────────────────────────────────────

export interface CreditOverride {
  ecueCode: string;
  homeroom: string;   // '' = global override
  credits: number;
}

// ─── Term Configuration ─────────────────────────────────────────────────────

export interface TermDefinition {
  id: string;          // e.g. 'S1', 'S2'
  label: string;       // e.g. 'Semestre 1'
  patterns: string[];  // substrings to match in ECUE raw names, e.g. ['- S2', '- SEM2']
}

export interface TermConfig {
  terms: TermDefinition[];
  defaultTermId: string;  // ECUEs with no pattern match get this term
}

// ─── App State ───────────────────────────────────────────────────────────────

export type AppView = 'upload' | 'dashboard' | 'students' | 'student-detail' | 'deliberation' | 'admin';

export interface AppData {
  courses: CourseStructure | null;
  parsedExcel: ParsedExcel | null;
  students: Student[] | null;
  multiClass: MultiClassData | null;
  creditOverrides: CreditOverride[];
  termConfig: TermConfig;
  logo?: string; // Base64 encoded image or URL
}

export interface JuryMember {
  name: string;
  role: string;
}

export interface PVConfig {
  date: string;
  lieu: string;
  presidentJury: string;
  juryMembers: JuryMember[];
  observationsDiverses: string;
}

// ─── Firebase / Session Types ──────────────────────────────────────────────

export type AppRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: AppRole;
  status: UserStatus;
  createdAt: unknown;
  deleted?: boolean;
  deletedAt?: unknown;
}

export type SessionRole = 'owner' | 'editor' | 'reader';

export interface SessionDoc {
  name: string;
  description: string;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
  ownerId: string;
  members: Record<string, SessionRole>;
  memberEmails: string[];
  data: {
    courses: CourseStructure;
    creditOverrides: CreditOverride[];
    termConfig?: TermConfig;
  } | null;
}

export interface ClassDoc {
  sheetName: string;
  groupName: string;
  niveau: string;
  filiere: string;
  semester: string;
  date: string;
  level: string;
  parsedExcel: ParsedExcel;
  students: Student[];
}

export interface SnapshotDoc {
  createdAt: unknown;
  label: string;
  data: {
    courses: CourseStructure | null;
    classes: ClassDoc[];
    creditOverrides: CreditOverride[];
    termConfig?: TermConfig;
  };
}

// ─── Validation Rules Engine ──────────────────────────────────────────────

/**
 * Mode de validation d'une UE :
 *  - 'grade'   : avg >= passMark (comportement historique)
 *  - 'credits' : crédits obtenus >= minCredits
 *  - 'both'    : les deux conditions doivent être satisfaites
 */
export type UEValidationMode = 'grade' | 'credits' | 'both';

/**
 * Mode de calcul du seuil AUTORISÉ pour le semestre / l'annuel :
 *  - 'ratio'    : seuil = floor(maxCredits * autoriseMinCreditsRatio)
 *  - 'absolute' : seuil = autoriseMinCreditsAbsolute (valeur fixe en crédits)
 */
export type CreditThresholdMode = 'ratio' | 'absolute';

export interface ValidationRules {
  ecue: {
    passMark: number;                 // ECUE validated if avg >= this (default: 10)
  };
  ue: {
    passMark: number;                 // UE validated if avg >= this (default: 10)
    capitalizeEcueCredits: boolean;   // when UE fails, count individual ECUE credits (default: true)
    validationMode: UEValidationMode; // criterion: grade, credits or both (default: 'grade')
    minCredits: number;               // min credits earned to validate UE — used when mode != 'grade' (default: 0)
  };
  semester: {
    autoriseMinCreditsRatio: number;  // min credit% for AUTORISÉ — used when mode='ratio' (default: 0.8)
    autoriseMode: CreditThresholdMode; // 'ratio' | 'absolute' (default: 'ratio')
    autoriseMinCreditsAbsolute: number; // fixed credit count for AUTORISÉ — used when mode='absolute' (default: 0)
  };
  annual: {
    autoriseMinCreditsRatio: number;  // min credit% for AUTORISÉ annual — used when mode='ratio' (default: 0.8)
    autoriseMode: CreditThresholdMode; // 'ratio' | 'absolute' (default: 'ratio')
    autoriseMinCreditsAbsolute: number; // fixed credit count for AUTORISÉ — used when mode='absolute' (default: 0)
  };
  repechage: {
    enabled: boolean;                 // enable repêchage rule (default: true)
    minUEAverage: number;             // min UE average for repêchage (default: 9.5)
    maxFailedUEs: number;             // max failed UEs for repêchage eligibility (default: 1)
  };
}

export const DEFAULT_VALIDATION_RULES: ValidationRules = {
  ecue: { passMark: 10 },
  ue: { passMark: 10, capitalizeEcueCredits: true, validationMode: 'grade', minCredits: 0 },
  semester: { autoriseMinCreditsRatio: 0.8, autoriseMode: 'ratio', autoriseMinCreditsAbsolute: 0 },
  annual: { autoriseMinCreditsRatio: 0.8, autoriseMode: 'ratio', autoriseMinCreditsAbsolute: 0 },
  repechage: { enabled: true, minUEAverage: 9.5, maxFailedUEs: 1 },
};

export interface UserDoc {
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: unknown;
}
