/* ============================================================
   FamilyBuild — Authentication Service (mock backend)
   ------------------------------------------------------------
   Centralized authentication + session state. The UI never
   touches credentials directly; it calls this service.

   MOCK IMPLEMENTATION NOTES (clearly separated from prod):
   - Credentials live in localStorage with a non-reversible demo
     hash. NEVER store plaintext passwords.
   - Password reset has no email service yet: requestPasswordReset
     returns the token to the caller so the dev UI can surface it,
     clearly labeled as mock behavior. In production this function
     would email a link and return nothing sensitive.
   - To connect a real backend, replace each exported function
     with an API call — signatures are backend-shaped on purpose:
       signIn(email, password)        → POST /auth/login
       signUp(input)                  → POST /auth/register
       requestPasswordReset(email)    → POST /auth/forgot-password
       resetPassword(token, password) → POST /auth/reset-password
       changePassword(...)            → POST /account/password
       currentSession()               → GET /auth/session
   ============================================================ */

import { DEMO_ACCOUNTS } from "../data/mockData";
import type { User, UserRole } from "../data/types";
import { STORAGE_KEYS, load, save, removeKey } from "./storage";

/* ---------- Types ---------- */

export interface CredentialRecord {
  userId: string;
  email: string;
  /** Demo hash of the password — never plaintext. */
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  signedInAt: string;
}

interface ResetTokenRecord {
  /** Hashed token — the raw token is never stored. */
  tokenHash: string;
  userId: string;
  expiresAt: string;
  used: boolean;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

/** Safe default role for self-registered accounts (never Owner). */
const DEFAULT_SIGNUP_ROLE: UserRole = "worker";

/** Reset links stay valid for 30 minutes. */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/* ---------- Demo password hashing (MOCK — replace server-side) ---------- */

/**
 * FNV-1a based digest with a fixed app salt. This is NOT cryptographically
 * secure and must be replaced by real hashing (bcrypt/argon2) on a backend.
 * It exists only so plaintext passwords never appear in storage or code.
 */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashPassword(password: string): string {
  const salted = `familybuild::v3::${password}`;
  const a = fnv1a(salted).toString(16).padStart(8, "0");
  const b = fnv1a(`${salted}::${salted}`).toString(16).padStart(8, "0");
  const c = fnv1a(`${b}:${salted}`).toString(16).padStart(8, "0");
  const d = fnv1a(`${salted}:${a}`).toString(16).padStart(8, "0");
  return `fb1$${a}${b}${c}${d}`;
}

/* ---------- Validation helpers ---------- */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Minimum 8 chars, at least one letter and one number. */
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

/* ---------- Credential + user registry stores ---------- */

type CredentialMap = Record<string, CredentialRecord>; // keyed by lowercase email

function loadCredentials(): CredentialMap {
  return load<CredentialMap>(STORAGE_KEYS.credentials, {});
}

function saveCredentials(map: CredentialMap): void {
  save(STORAGE_KEYS.credentials, map);
}

function loadUsers(): User[] {
  return load<User[]>(STORAGE_KEYS.registeredUsers, []);
}

function saveUsers(users: User[]): void {
  save(STORAGE_KEYS.registeredUsers, users);
}

function loadResetTokens(): ResetTokenRecord[] {
  return load<ResetTokenRecord[]>(STORAGE_KEYS.resetTokens, []);
}

function saveResetTokens(tokens: ResetTokenRecord[]): void {
  save(STORAGE_KEYS.resetTokens, tokens);
}

/**
 * Ensures the user registry + credential store exist and contain the
 * seeded demo accounts. Runs lazily on every service call (cheap).
 */
function ensureSeeded(): void {
  if (loadUsers().length === 0) {
    saveUsers([...DEMO_ACCOUNTS]);
  }
  const creds = loadCredentials();
  let dirty = false;
  for (const account of DEMO_ACCOUNTS) {
    const key = account.email.toLowerCase();
    if (!creds[key]) {
      // Seeded demo accounts all use the documented demo password.
      creds[key] = {
        userId: account.id,
        email: account.email.toLowerCase(),
        passwordHash: hashPassword("demo1234"),
        createdAt: new Date().toISOString(),
      };
      dirty = true;
    }
  }
  if (dirty) saveCredentials(creds);
}

/* ---------- Public API ---------- */

export function getUserById(userId: string): User | null {
  ensureSeeded();
  return loadUsers().find((u) => u.id === userId) ?? null;
}

export function getUserByEmail(email: string): User | null {
  ensureSeeded();
  const key = email.trim().toLowerCase();
  return loadUsers().find((u) => u.email.toLowerCase() === key) ?? null;
}

/** All registered accounts (used by the Settings role switcher). */
export function listUsers(): User[] {
  ensureSeeded();
  return loadUsers();
}

/* ---------- Sign in ---------- */

export type AuthResult = { ok: true; user: User } | { ok: false; error: string };

export function signIn(email: string, password: string): AuthResult {
  ensureSeeded();
  const key = email.trim().toLowerCase();
  if (!key || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  const creds = loadCredentials();
  const record = creds[key];
  if (!record) {
    return { ok: false, error: "No account found with that email." };
  }
  if (record.passwordHash !== hashPassword(password)) {
    return { ok: false, error: "Incorrect password. Please try again." };
  }
  const user = getUserById(record.userId);
  if (!user) {
    return { ok: false, error: "Account record is missing. Contact the Owner." };
  }
  createSession(user.id);
  return { ok: true, user };
}

/* ---------- Sign up ---------- */

export function signUp(input: SignUpInput): AuthResult {
  ensureSeeded();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { ok: false, error: "Name is required." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!isValidPassword(input.password)) {
    return { ok: false, error: "Password must be at least 8 characters and include letters and numbers." };
  }
  if (getUserByEmail(email)) {
    return { ok: false, error: "An account with that email already exists." };
  }

  // New accounts get the safe default WORKER role — never elevated roles.
  // An Owner can promote them later through People management.
  const userId = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const personId = `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const user: User = {
    id: userId,
    personId,
    name,
    email,
    role: DEFAULT_SIGNUP_ROLE,
    title: "Worker",
  };

  // Persist account profile + directory record so messaging/tasks work.
  saveUsers([...loadUsers(), user]);
  const people = load<import("../data/types").Person[]>(STORAGE_KEYS.people, []);
  save(STORAGE_KEYS.people, [
    ...people,
    {
      id: personId,
      kind: "worker" as const,
      name,
      email,
      phone: "",
      title: "Worker",
      status: "active" as const,
    },
  ]);

  const creds = loadCredentials();
  creds[email] = {
    userId,
    email,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  saveCredentials(creds);

  createSession(userId);
  return { ok: true, user };
}

/* ---------- Session ---------- */

export function createSession(userId: string): void {
  const session: Session = { userId, signedInAt: new Date().toISOString() };
  save(STORAGE_KEYS.session, session);
}

export function clearSession(): void {
  removeKey(STORAGE_KEYS.session);
}

/** Resolves the active session into the full current user (or null). */
export function currentSessionUser(): User | null {
  const session = load<Session | null>(STORAGE_KEYS.session, null);
  if (!session?.userId) return null;
  return getUserById(session.userId);
}

/* ---------- Forgot / reset password ---------- */

export interface MockResetRequest {
  /** True when the email matched an existing account. */
  matched: boolean;
  /**
   * MOCK ONLY: raw token surfaced for the dev UI because there is no
   * email service yet. In production this stays server-side inside an
   * emailed link and is never returned by the API.
   */
  mockToken?: string;
}

export function requestPasswordReset(email: string): MockResetRequest {
  ensureSeeded();
  const user = getUserByEmail(email);
  if (!user) {
    // Do not reveal whether the account exists beyond what the caller needs.
    return { matched: false };
  }
  const rawToken = `${user.id}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}`;
  const tokens = loadResetTokens();
  tokens.push({
    tokenHash: hashPassword(rawToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
    used: false,
  });
  saveResetTokens(tokens);
  return { matched: true, mockToken: rawToken };
}

export function validateResetToken(token: string): { valid: boolean; error?: string } {
  ensureSeeded();
  if (!token.trim()) return { valid: false, error: "Missing reset token." };
  const tokens = loadResetTokens();
  const record = tokens.find((t) => t.tokenHash === hashPassword(token.trim()));
  if (!record) return { valid: false, error: "This reset link is not valid." };
  if (record.used) return { valid: false, error: "This reset link was already used." };
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { valid: false, error: "This reset link has expired. Request a new one." };
  }
  return { valid: true };
}

export function resetPassword(token: string, newPassword: string): AuthResult {
  ensureSeeded();
  if (!isValidPassword(newPassword)) {
    return { ok: false, error: "Password must be at least 8 characters and include letters and numbers." };
  }
  const trimmed = token.trim();
  const tokens = loadResetTokens();
  const index = tokens.findIndex((t) => t.tokenHash === hashPassword(trimmed));
  if (index === -1) return { ok: false, error: "This reset link is not valid." };
  const record = tokens[index];
  if (record.used) return { ok: false, error: "This reset link was already used." };
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This reset link has expired. Request a new one." };
  }

  const user = getUserById(record.userId);
  if (!user) return { ok: false, error: "Account no longer exists." };

  // Update the credential hash…
  const creds = loadCredentials();
  const credKey = user.email.toLowerCase();
  if (creds[credKey]) {
    creds[credKey] = { ...creds[credKey], passwordHash: hashPassword(newPassword) };
    saveCredentials(creds);
  }
  // …and invalidate the token (single use).
  tokens[index] = { ...record, used: true };
  saveResetTokens(tokens);

  return { ok: true, user };
}

/* ---------- Change password (signed-in account settings) ---------- */

export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): AuthResult {
  ensureSeeded();
  const user = getUserById(userId);
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isValidPassword(newPassword)) {
    return { ok: false, error: "New password must be at least 8 characters and include letters and numbers." };
  }
  const creds = loadCredentials();
  const credKey = user.email.toLowerCase();
  const record = creds[credKey];
  if (!record) return { ok: false, error: "Credential record missing for this account." };
  if (record.passwordHash !== hashPassword(currentPassword)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  creds[credKey] = { ...record, passwordHash: hashPassword(newPassword) };
  saveCredentials(creds);
  return { ok: true, user };
}