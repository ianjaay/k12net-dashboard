// ─── Multi-Establishment Types ──────────────────────────────────────────────
// Types for the multi-establishment management system.
// Supports hierarchy: Super-Admin → Establishments → Members → Sessions

import type { AcademicYear, CourseDefinition, K12YearRulesConfig } from './k12';

// ─── Roles ──────────────────────────────────────────────────────────────────

/** Global app-level role */
export type AppRole = 'super-admin' | 'admin' | 'user';

/** Role within a specific establishment */
export type EstablishmentRole = 'admin' | 'user';

// ─── Establishment ──────────────────────────────────────────────────────────

/** Type of educational establishment */
export type EstablishmentType = 'college' | 'lycee' | 'college-lycee';

/** Cycle of education */
export type EstablishmentCycle = 'college' | 'lycee' | 'both';

/** Main establishment document stored at establishments/{id} */
export interface Establishment {
  id: string;
  name: string;
  code?: string;
  type: EstablishmentType;
  cycle: EstablishmentCycle;
  address?: string;
  city?: string;
  region?: string;

  // Settings (migrated from globalSettings/default)
  logo?: string;
  schoolName?: string;
  photoBaseUrl?: string;
  academicYear?: AcademicYear;
  rulesConfig?: K12YearRulesConfig;
  yearConfigs?: Record<AcademicYear, K12YearRulesConfig>;
  courseCatalog?: CourseDefinition[];

  // Metadata
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string; // uid of creator
}

/** Data required to create a new establishment */
export type EstablishmentCreateData = Omit<Establishment, 'id' | 'createdAt' | 'updatedAt'>;

/** Data for updating an establishment */
export type EstablishmentUpdateData = Partial<Omit<Establishment, 'id' | 'createdAt' | 'createdBy'>>;

// ─── Establishment Members ──────────────────────────────────────────────────

/** Member document stored at establishments/{id}/members/{uid} */
export interface EstablishmentMember {
  uid: string;
  email: string;
  displayName: string;
  role: EstablishmentRole;
  joinedAt: unknown;
}

/** Data for adding a member to an establishment */
export type EstablishmentMemberData = Omit<EstablishmentMember, 'joinedAt'>;

// ─── User Profile Extensions ────────────────────────────────────────────────

/** Extended user profile with establishment support */
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
  /** IDs of establishments the user belongs to */
  establishments?: string[];
  /** Last selected establishment */
  currentEstablishment?: string;
}

export type UserStatus = 'active' | 'pending' | 'suspended';

// ─── Establishment Context Types ────────────────────────────────────────────

/** State provided by EstablishmentContext */
export interface EstablishmentContextState {
  /** Currently selected establishment */
  currentEstablishment: Establishment | null;
  /** All establishments the user has access to */
  userEstablishments: Establishment[];
  /** Whether establishments are being loaded */
  loading: boolean;
  /** Switch to a different establishment */
  switchEstablishment: (establishmentId: string) => Promise<void>;
  /** Refresh the list of establishments */
  refreshEstablishments: () => Promise<void>;
}
