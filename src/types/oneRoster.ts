/**
 * OneRoster v1.1 API types.
 * Based on IMS Global OneRoster specification.
 * Used by the API import mode (Mode 2).
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. COMMON TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type OneRosterStatus = 'active' | 'tobedeleted';

export type OneRosterOrgType =
  | 'national'
  | 'state'
  | 'district'
  | 'department'
  | 'school'
  | 'local';

export type OneRosterUserRole =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'guardian'
  | 'aide'
  | 'administrator';

export type OneRosterSessionType =
  | 'schoolYear'
  | 'term'
  | 'gradingPeriod'
  | 'semester';

export type OneRosterEnrollmentRole = 'student' | 'teacher';

export interface OneRosterRef {
  sourcedId: string;
  type: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ORGANISATION (Org) — DRENA & Établissement
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterOrg {
  sourcedId: string;
  status: OneRosterStatus;
  dateLastModified: string;
  name: string;
  type: OneRosterOrgType;
  identifier: string;
  parent?: OneRosterRef;
  children?: OneRosterRef[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. CLASS
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterClass {
  sourcedId: string;
  status: OneRosterStatus;
  dateLastModified: string;
  title: string;
  classCode?: string;
  classType?: string;
  location?: string;
  school: OneRosterRef;
  terms: OneRosterRef[];
  course?: OneRosterRef;
  grades?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. USER (Student / Teacher)
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterUser {
  sourcedId: string;
  status: OneRosterStatus;
  dateLastModified: string;
  username: string;
  givenName: string;
  familyName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  role: OneRosterUserRole;
  identifier: string;
  sms?: string;
  orgs: OneRosterRef[];
  grades?: string[];
  agents?: OneRosterRef[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. ENROLLMENT
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterEnrollment {
  sourcedId: string;
  status: OneRosterStatus;
  dateLastModified: string;
  role: OneRosterEnrollmentRole;
  user: OneRosterRef;
  class: OneRosterRef;
  school: OneRosterRef;
  primary?: boolean;
  beginDate?: string;
  endDate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. ACADEMIC SESSION
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterSession {
  sourcedId: string;
  status: OneRosterStatus;
  dateLastModified: string;
  title: string;
  type: OneRosterSessionType;
  startDate: string;
  endDate: string;
  schoolYear: string;
  parent?: OneRosterRef;
  children?: OneRosterRef[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. GRADESYNC (LineItem + Result)
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterLineItem {
  sourcedId: string;
  title: string;
  description?: string;
  assignDate: string;
  dueDate: string;
  resultValueMin: number;
  resultValueMax: number;
  class: OneRosterRef;
  gradingPeriod: OneRosterRef;
  category?: OneRosterRef;
}

export interface OneRosterResult {
  sourcedId: string;
  score: number;
  scoreDate: string;
  scoreStatus: 'exempt' | 'fully graded' | 'not submitted' | 'partially graded';
  lineItem: OneRosterRef;
  student: OneRosterRef;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. API CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export interface OneRosterApiConfig {
  id: string;
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  syncMode: 'full' | 'delta';
  lastSyncDate?: string;
  autoSyncEnabled: boolean;
  autoSyncInterval?: number;
  schoolYearFilter?: string;
  activeOnly: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. SYNC LOG
// ═══════════════════════════════════════════════════════════════════════════

export interface SyncLog {
  id: string;
  date: string;
  type: 'full' | 'delta';
  source: 'api' | 'excel';
  entites_synchronisees: {
    orgs: number;
    schools: number;
    classes: number;
    students: number;
    teachers: number;
    enrollments: number;
  };
  statut: 'succes' | 'partiel' | 'erreur';
  erreurs?: string[];
  duree_ms: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. IMPORT WIZARD TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ImportMode = 'excel' | 'api';

export interface OrgSelectionItem {
  org: OneRosterOrg;
  selected: boolean;
}

export interface OrgSelectionTree {
  etablissements: OrgSelectionItem[];
}

export interface SessionSelection {
  session: OneRosterSession;
  selected: boolean;
  trimestres: OneRosterSession[];
}

export interface ImportProgress {
  total_etablissements: number;
  etablissements_termines: number;
  etablissement_en_cours: string;
  classes_importees: number;
  eleves_importes: number;
  eleves_total_estime: number;
  enseignants_importes: number;
  inscriptions_importees: number;
  pourcentage: number;
  statut: 'en_cours' | 'termine' | 'erreur' | 'annule';
  erreurs: string[];
}
