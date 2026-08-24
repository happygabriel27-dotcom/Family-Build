/* ============================================================
   FamilyBuild — Storage Layer
   ------------------------------------------------------------
   Thin wrapper over localStorage used by the service layer.
   In production this module is the seam to replace with real
   API calls (Supabase / REST / GraphQL): swap `load`/`save`
   for fetch calls and keep the rest of the app unchanged.
   ============================================================ */

const PREFIX = "familybuild:v3:";

/** Bump when seed shape changes so dev browsers reseed automatically. */
export const SEED_VERSION = "2026-08-24.3";

export const STORAGE_KEYS = {
  seeded: `${PREFIX}seed-version`,
  user: `${PREFIX}user`,
  /* --- authentication (mock backend; replace with real API later) --- */
  registeredUsers: `${PREFIX}auth-users`,
  credentials: `${PREFIX}auth-credentials`,
  session: `${PREFIX}auth-session`,
  resetTokens: `${PREFIX}auth-reset-tokens`,
  people: `${PREFIX}people`,
  properties: `${PREFIX}properties`,
  projects: `${PREFIX}projects`,
  tasks: `${PREFIX}tasks`,
  requests: `${PREFIX}requests`,
  inventory: `${PREFIX}inventory`,
  purchaseOrders: `${PREFIX}purchase-orders`,
  transactions: `${PREFIX}transactions`,
  workReports: `${PREFIX}work-reports`,
  inventoryTransactions: `${PREFIX}inventory-transactions`,
  announcements: `${PREFIX}announcements`,
  suggestions: `${PREFIX}suggestions`,
  conversations: `${PREFIX}conversations`,
  documents: `${PREFIX}documents`,
  files: `${PREFIX}files`,
  websiteSettings: `${PREFIX}website-settings`,
  announcementReads: `${PREFIX}announcement-reads`,
  notifications: `${PREFIX}notifications`,
  activity: `${PREFIX}activity`,
  wikiCategories: `${PREFIX}wiki-categories`,
  wikiArticles: `${PREFIX}wiki-articles`,
  sidebarCollapsed: `${PREFIX}sidebar-collapsed`,
};

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — fail silently in demo mode.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Clears every FamilyBuild key (used by "Reset demo data"). */
export function clearAll(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}