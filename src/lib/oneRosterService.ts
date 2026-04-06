/**
 * OneRoster v1.1 API Service.
 * Handles OAuth2 authentication, paginated data fetching,
 * and mapping OneRoster entities to our application model.
 */
import type {
  OneRosterApiConfig,
  OneRosterOrg,
  OneRosterClass,
  OneRosterUser,
  OneRosterEnrollment,
  OneRosterSession,
  OneRosterLineItem,
  OneRosterResult,
  SyncLog,
} from '../types/oneRoster';

// ═══════════════════════════════════════════════════════════════════════════
// Proxy helper — routes requests through Vite dev server to avoid CORS
// ═══════════════════════════════════════════════════════════════════════════

const IS_DEV = import.meta.env.DEV;

function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!IS_DEV) return fetch(url, init);

  // In dev, route through /api-proxy with X-Target-Url header
  const headers = new Headers(init?.headers);
  headers.set('X-Target-Url', url);
  return fetch('/api-proxy', { ...init, headers });
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

export class OneRosterService {
  private config: OneRosterApiConfig;
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: OneRosterApiConfig) {
    this.config = config;
    // Normalize baseUrl: strip trailing /ims/oneroster/v1p1 if user included it,
    // since all endpoint paths already include it.
    let url = config.baseUrl.replace(/\/+$/, '');
    url = url.replace(/\/ims\/oneroster\/v1p1$/i, '');
    this.baseUrl = url;
  }

  // ─── Auth ────────────────────────────────────────────────────────────

  private async ensureToken(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    if (this.config.scope) {
      params.set('scope', this.config.scope);
    }

    const res = await proxyFetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth2 token request failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    this.token = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;
    this.tokenExpiry = new Date(Date.now() + (expiresIn - 60) * 1000); // 60s buffer
    return this.token;
  }

  // ─── Generic fetch ───────────────────────────────────────────────────

  private async apiFetch(endpoint: string): Promise<Response> {
    const token = await this.ensureToken();
    const url = `${this.baseUrl}${endpoint}`;
    const res = await proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${endpoint} failed (${res.status}): ${text}`);
    }
    return res;
  }

  private async fetchAll<T>(
    endpoint: string,
    key: string,
    filter?: string,
    pageSize = 100,
  ): Promise<T[]> {
    const allItems: T[] = [];
    let offset = 0;
    let hasMore = true;

    // Note: K12net server does not support filter=status='active' (returns 500).
    // We skip the status filter and do client-side filtering instead.
    const filterParam = filter ? `&filter=${encodeURIComponent(filter)}` : '';

    while (hasMore) {
      const res = await this.apiFetch(
        `${endpoint}?offset=${offset}&limit=${pageSize}${filterParam}`,
      );
      const data = await res.json();

      // K12net returns data under non-standard keys (e.g. 'orgs' instead of 'schools',
      // 'users' instead of 'students'/'teachers'). Try the expected key first,
      // then find the first array value in the response as a universal fallback.
      let items: T[] = data[key];
      if (!items || !Array.isArray(items)) {
        // Universal fallback: find the first array in the response object
        items = Object.values(data).find((v): v is T[] => Array.isArray(v)) ?? [];
      }
      allItems.push(...items);

      const total = parseInt(res.headers.get('X-Total-Count') ?? '0', 10);
      offset += pageSize;
      hasMore = total > 0 ? offset < total : items.length === pageSize;
    }

    // Client-side active filter
    if (this.config.activeOnly) {
      return allItems.filter((item: any) => !item.status || item.status !== 'tobedeleted');
    }
    return allItems;
  }

  // ─── Public API endpoints ────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; tokenExpiry?: Date; error?: string }> {
    try {
      await this.ensureToken();
      return { success: true, tokenExpiry: this.tokenExpiry ?? undefined };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getOrgs(): Promise<OneRosterOrg[]> {
    return this.fetchAll<OneRosterOrg>('/ims/oneroster/v1p1/orgs', 'orgs');
  }

  async getSchools(): Promise<OneRosterOrg[]> {
    return this.fetchAll<OneRosterOrg>('/ims/oneroster/v1p1/schools', 'schools');
  }

  async getSchoolById(id: string): Promise<OneRosterOrg> {
    const res = await this.apiFetch(`/ims/oneroster/v1p1/schools/${encodeURIComponent(id)}`);
    const data = await res.json();
    return data.school ?? data.org;
  }

  async getClassesBySchool(schoolId: string): Promise<OneRosterClass[]> {
    return this.fetchAll<OneRosterClass>(
      `/ims/oneroster/v1p1/schools/${encodeURIComponent(schoolId)}/classes`,
      'classes',
    );
  }

  async getStudentsBySchool(schoolId: string): Promise<OneRosterUser[]> {
    return this.fetchAll<OneRosterUser>(
      `/ims/oneroster/v1p1/schools/${encodeURIComponent(schoolId)}/students`,
      'students',
    );
  }

  async getTeachersBySchool(schoolId: string): Promise<OneRosterUser[]> {
    return this.fetchAll<OneRosterUser>(
      `/ims/oneroster/v1p1/schools/${encodeURIComponent(schoolId)}/teachers`,
      'teachers',
    );
  }

  async getEnrollmentsBySchool(
    schoolId: string,
    role?: 'student' | 'teacher',
  ): Promise<OneRosterEnrollment[]> {
    const roleFilter = role ? `role='${role}'` : undefined;
    return this.fetchAll<OneRosterEnrollment>(
      `/ims/oneroster/v1p1/schools/${encodeURIComponent(schoolId)}/enrollments`,
      'enrollments',
      roleFilter,
    );
  }

  async getAcademicSessions(): Promise<OneRosterSession[]> {
    return this.fetchAll<OneRosterSession>(
      '/ims/oneroster/v1p1/academicSessions',
      'academicSessions',
    );
  }

  async getLineItemsByClass(classId: string): Promise<OneRosterLineItem[]> {
    return this.fetchAll<OneRosterLineItem>(
      `/ims/oneroster/v1p1/classes/${encodeURIComponent(classId)}/lineItems`,
      'lineItems',
    );
  }

  async getResultsByLineItem(
    classId: string,
    lineItemId: string,
  ): Promise<OneRosterResult[]> {
    return this.fetchAll<OneRosterResult>(
      `/ims/oneroster/v1p1/classes/${encodeURIComponent(classId)}/lineItems/${encodeURIComponent(lineItemId)}/results`,
      'results',
    );
  }

  // ─── Delta endpoints ─────────────────────────────────────────────────

  async getSchoolsDelta(since: string): Promise<OneRosterOrg[]> {
    return this.fetchAll<OneRosterOrg>(
      '/ims/oneroster/v1p1/schools',
      'schools',
      `dateLastModified>'${since}'`,
    );
  }

  async getStudentsDelta(since: string): Promise<OneRosterUser[]> {
    return this.fetchAll<OneRosterUser>(
      '/ims/oneroster/v1p1/students',
      'students',
      `dateLastModified>'${since}'`,
    );
  }

  async getClassesDelta(since: string): Promise<OneRosterClass[]> {
    return this.fetchAll<OneRosterClass>(
      '/ims/oneroster/v1p1/classes',
      'classes',
      `dateLastModified>'${since}'`,
    );
  }

  async getEnrollmentsDelta(schoolId: string, since: string): Promise<OneRosterEnrollment[]> {
    return this.fetchAll<OneRosterEnrollment>(
      `/ims/oneroster/v1p1/schools/${encodeURIComponent(schoolId)}/enrollments`,
      'enrollments',
      `dateLastModified>'${since}'`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Mapping helpers: OneRoster → application model
// ═══════════════════════════════════════════════════════════════════════════

import type {
  DRENA,
  Etablissement,
  ClasseML,
  EleveML,
  Enseignant,
  EnrollmentML,
  AnneeScolaire,
  Trimestre,
  StructureClasses,
} from '../types/multiLevel';
import { MINISTERE_DEFAULT, parseNomClasse } from '../types/multiLevel';

export function mapOrgToDRENA(org: OneRosterOrg): DRENA {
  return {
    id: org.sourcedId,
    code: org.identifier || org.sourcedId,
    nom: org.name,
    ministere_id: MINISTERE_DEFAULT.id,
    source: 'api',
  };
}

const EMPTY_STRUCTURE: StructureClasses = {
  nb_classes: {
    sixieme: 0, cinquieme: 0, quatrieme: 0, troisieme: 0, total: 0,
  },
  effectifs: {
    sixieme: 0, cinquieme: 0, quatrieme: 0, troisieme: 0, total: 0,
  },
};

export function mapOrgToEtablissement(org: OneRosterOrg, drenaId: string): Etablissement {
  return {
    id: org.sourcedId,
    code: org.identifier || org.sourcedId,
    nom: org.name,
    type_focus: 'Général',
    nb_administratifs: 0,
    nb_enseignants: 0,
    nb_conseillers: 0,
    structure_classes: { ...EMPTY_STRUCTURE },
    drena_id: drenaId,
    source: 'api',
  };
}

export function mapClassToClasseML(
  cls: OneRosterClass,
  etablissementId: string,
  anneeScolaire: string,
): ClasseML {
  const parsed = parseNomClasse(cls.title);
  return {
    id: cls.sourcedId,
    nom: cls.title,
    niveau: parsed?.niveau ?? 'Sixième',
    serie: parsed?.serie,
    etablissement_id: etablissementId,
    annee_scolaire: anneeScolaire,
    term_ids: cls.terms?.map(t => t.sourcedId),
    source: 'api',
  };
}

export function mapUserToEleve(
  user: OneRosterUser,
  classeId: string,
  salleDeClasse: string,
  etablissementId: string,
  anneeScolaire: string,
): EleveML {
  const parsed = parseNomClasse(salleDeClasse);
  return {
    id: user.sourcedId,
    matricule: user.identifier || user.username || user.sourcedId,
    nom: user.familyName,
    prenom: user.givenName,
    date_naissance: '',
    pays_naissance: '',
    sexe: 'Masculin',
    nationalite: '',
    niveau_scolaire: parsed?.niveau ?? 'Sixième',
    serie: parsed?.serie,
    salle_de_classe: salleDeClasse,
    lv2: '',
    ap_mus: '',
    statut: '',
    qualite: 'Non Redoublant',
    statut_internat: '',
    type_adhesion: '',
    classe_id: classeId,
    etablissement_id: etablissementId,
    annee_scolaire: anneeScolaire,
    source: 'api',
  };
}

export function mapUserToEnseignant(
  user: OneRosterUser,
  etablissementId: string,
): Enseignant {
  return {
    id: user.sourcedId,
    matricule: user.identifier || user.username || user.sourcedId,
    nom: user.familyName,
    prenom: user.givenName,
    email: user.email,
    telephone: user.phone,
    etablissement_id: etablissementId,
    source: 'api',
  };
}

export function mapEnrollment(e: OneRosterEnrollment): EnrollmentML {
  return {
    id: e.sourcedId,
    user_id: e.user.sourcedId,
    class_id: e.class.sourcedId,
    role: e.role,
    school_id: e.school.sourcedId,
    begin_date: e.beginDate,
    end_date: e.endDate,
  };
}

export function mapSessionToAnneeScolaire(session: OneRosterSession): AnneeScolaire {
  return {
    id: session.sourcedId,
    libelle: session.title,
    debut: session.startDate,
    fin: session.endDate,
    school_year: session.schoolYear,
    active: session.status === 'active',
  };
}

export function mapSessionToTrimestre(
  session: OneRosterSession,
  parentAnneeId: string,
): Trimestre {
  // Try to deduce trimestre number from title
  let numero: 1 | 2 | 3 = 1;
  const title = session.title.toLowerCase();
  if (/2|deux|second/i.test(title)) numero = 2;
  else if (/3|trois|troisième/i.test(title)) numero = 3;

  return {
    id: session.sourcedId,
    numero,
    titre: session.title,
    debut: session.startDate,
    fin: session.endDate,
    parent_annee_id: parentAnneeId,
  };
}

// ─── Build org selection tree ──────────────────────────────────────────

import type { OrgSelectionTree, SessionSelection } from '../types/oneRoster';

/**
 * Build the org selection list from a list of orgs (flat — no DRENA grouping).
 * Returns all schools directly as selectable items.
 */
export function buildOrgTree(orgs: OneRosterOrg[]): OrgSelectionTree {
  const schools = orgs.filter(o => o.type === 'school');
  // If no explicit schools, treat all orgs as schools
  const items = schools.length > 0 ? schools : orgs;
  return {
    etablissements: items.map(s => ({ org: s, selected: true })),
  };
}

export function buildSessionSelections(sessions: OneRosterSession[]): SessionSelection[] {
  const annees = sessions.filter(s => s.type === 'schoolYear');
  const trimestres = sessions.filter(s =>
    ['term', 'gradingPeriod', 'semester'].includes(s.type),
  );

  return annees.map(a => ({
    session: a,
    selected: false,
    trimestres: trimestres.filter(t => t.parent?.sourcedId === a.sourcedId),
  }));
}

// ─── SyncLog factory ───────────────────────────────────────────────────

export function createSyncLog(
  source: SyncLog['source'],
  type: SyncLog['type'],
): SyncLog {
  return {
    id: `sync_${Date.now()}`,
    date: new Date().toISOString(),
    type,
    source,
    entites_synchronisees: {
      orgs: 0, schools: 0, classes: 0, students: 0, teachers: 0, enrollments: 0,
    },
    statut: 'succes',
    erreurs: [],
    duree_ms: 0,
  };
}
