/* ============================================================
   FamilyBuild — Centralized Authorization
   ------------------------------------------------------------
   Single source of truth for what each role may do.

   1. `can(role, permission)` — fine-grained action checks used
      by UI (hide buttons) AND by mutating services (reject).
   2. ROUTE_ROLES + isRouteAllowed — route-level guard used by
      RequireRole so protected pages reject unauthorized access.

   Permission groups are intentionally separated:
     - BASIC APPLICATION PERMISSIONS (every role)
     - CUSTOMER SERVICE PERMISSIONS (support workflow)
     - ADMINISTRATIVE PERMISSIONS (owner unless granted)
   When a real backend exists, mirror ROLE_PERMISSIONS in API
   authorization; UI code stays unchanged.
   ============================================================ */

import { load, save } from "../services/storage";
import type { UserRole } from "./types";

/* ---------- Permissions ---------- */

export type Permission =
  // basic application access (all roles)
  | "dashboard.view"
  | "messages.view"
  | "messages.send"
  | "notifications.view"
  | "notifications.manage_own"
  | "profile.view"
  | "profile.edit"
  | "settings.personal.view"
  | "settings.admin.view"
  | "settings.view" // compatibility alias for personal settings access
  | "account.view" // compatibility alias for profile access
  | "help.view"
  // announcements (view is basic; management is administrative)
  | "announcement.view"
  | "announcement.create"
  | "announcement.edit"
  | "announcement.publish"
  | "announcement.delete"
  // properties & projects
  | "property.view"
  | "property.manage"
  | "project.view"
  | "project.create"
  | "project.edit"
  | "project.delete"
  // tasks
  | "task.view"
  | "task.create"
  | "task.edit"
  | "task.assign"
  | "task.delete"
  | "task.updateOwn"
  | "task.comment"
  | "task.escalate"
  // people
  | "people.view"
  | "people.manage"
  // inventory
  | "inventory.view"
  | "inventory.manage"
  | "inventory.move"
  // purchasing
  | "purchase.view"
  | "purchase.request"
  | "purchase.approve"
  | "purchase.receive"
  | "purchase.cancel"
  // finance
  | "finance.view"
  | "finance.manage"
  // reports
  | "reports.business"
  | "reports.field"
  | "report.submit"
  // support / tickets — Customer Service specialized permissions
  | "support.viewAll"
  | "support.viewAssigned"
  | "support.reply"
  | "support.assign"
  | "support.status"
  | "support.escalate"
  | "support.resolve"
  | "support.create"
  | "support.viewOwn"
  // historical compat names
  | "message.use"
  | "notification.use"
  // help & suggestions
  | "suggestion.create"
  | "suggestion.review"
  // wiki
  | "wiki.view"
  | "wiki.contribute"
  // documents & files (permission-aware; access also follows parent object)
  | "document.view"
  | "document.create"
  | "document.edit"
  | "document.delete"
  | "document.share"
  | "file.view"
  | "file.upload"
  | "file.edit"
  | "file.delete"
  | "file.share"
  // website management (administrative — owner unless granted)
  | "website.view"
  | "website.branding.edit"
  | "website.content.edit"
  // customers directory (CS)
  | "customers.directory"
  // admin / org configuration
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "roles.manage"
  | "permissions.manage"
  | "system.manage"
  // technical/system work
  | "technical.tasks";

const ALL: Permission[] = [
  "dashboard.view",
  "messages.view",
  "messages.send",
  "notifications.view",
  "notifications.manage_own",
  "profile.view",
  "profile.edit",
  "settings.personal.view",
  "settings.admin.view",
  "settings.view",
  "account.view",
  "help.view",
  "announcement.view",
  "announcement.create",
  "announcement.edit",
  "announcement.publish",
  "announcement.delete",
  "property.view",
  "property.manage",
  "project.view",
  "project.create",
  "project.edit",
  "project.delete",
  "task.view",
  "task.create",
  "task.edit",
  "task.assign",
  "task.delete",
  "task.updateOwn",
  "task.comment",
  "task.escalate",
  "people.view",
  "people.manage",
  "inventory.view",
  "inventory.manage",
  "inventory.move",
  "purchase.view",
  "purchase.request",
  "purchase.approve",
  "purchase.receive",
  "purchase.cancel",
  "finance.view",
  "finance.manage",
  "reports.business",
  "reports.field",
  "report.submit",
  "support.viewAll",
  "support.viewAssigned",
  "support.reply",
  "support.assign",
  "support.status",
  "support.escalate",
  "support.resolve",
  "support.create",
  "support.viewOwn",
  "message.use",
  "notification.use",
  "suggestion.create",
  "suggestion.review",
  "wiki.view",
  "wiki.contribute",
  "document.view",
  "document.create",
  "document.edit",
  "document.delete",
  "document.share",
  "file.view",
  "file.upload",
  "file.edit",
  "file.delete",
  "file.share",
  "website.view",
  "website.branding.edit",
  "website.content.edit",
  "customers.directory",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "roles.manage",
  "permissions.manage",
  "system.manage",
  "technical.tasks",
];

function set(...perms: Permission[]): Set<Permission> {
  return new Set(perms);
}

/* ---------- Shared basic permission set ----------
   Every active role receives these automatically:
   dashboard, messages, notifications, profile, personal settings,
   announcements (view), help. */
const BASIC: Permission[] = [
  "dashboard.view",
  "messages.view",
  "messages.send",
  "notifications.view",
  "notifications.manage_own",
  "profile.view",
  "profile.edit",
  "settings.personal.view",
  "settings.view",
  "account.view",
  "help.view",
  "announcement.view",
  "message.use",
  "notification.use",
  /* Documents & Files are basic application features. Every role can
     view documents/files it is authorized to see and upload its own;
     management rights are granted per role below. */
  "document.view",
  "file.view",
  "file.upload",
];

/**
 * Central permission matrix.
 *
 * Active application roles: owner, manager, developer, worker,
 * customer-service. Customer Service is a specialized employee/account
 * role: full basic access + support workflow, but NO administrative
 * permissions unless the Owner explicitly grants them via Settings.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  owner: set(
    ...BASIC,
    "settings.admin.view",
    "announcement.create",
    "announcement.edit",
    "announcement.publish",
    "announcement.delete",
    "property.view",
    "property.manage",
    "project.view",
    "project.create",
    "project.edit",
    "project.delete",
    "task.view",
    "task.create",
    "task.edit",
    "task.assign",
    "task.delete",
    "task.updateOwn",
    "task.comment",
    "task.escalate",
    "people.view",
    "people.manage",
    "inventory.view",
    "inventory.manage",
    "inventory.move",
    "purchase.view",
    "purchase.request",
    "purchase.approve",
    "purchase.receive",
    "purchase.cancel",
    "finance.view",
    "finance.manage",
    "reports.business",
    "reports.field",
    "report.submit",
    "support.viewAll",
    "support.viewAssigned",
    "support.reply",
    "support.assign",
    "support.status",
    "support.escalate",
    "support.resolve",
    "support.create",
    "support.viewOwn",
    "suggestion.create",
    "suggestion.review",
    "wiki.view",
    "wiki.contribute",
    "document.create",
    "document.edit",
    "document.delete",
    "document.share",
    "file.edit",
    "file.delete",
    "file.share",
    "website.view",
    "website.branding.edit",
    "website.content.edit",
    "customers.directory",
    "users.view",
    "users.create",
    "users.edit",
    "users.delete",
    "roles.manage",
    "permissions.manage",
    "system.manage",
    "technical.tasks",
  ),

  manager: set(
    ...BASIC,
    "announcement.create",
    "announcement.edit",
    "announcement.publish",
    "announcement.delete",
    "property.view",
    "project.view",
    "project.create",
    "project.edit",
    "task.view",
    "task.create",
    "task.edit",
    "task.assign",
    "task.updateOwn",
    "task.comment",
    "task.escalate",
    "people.view",
    "people.manage",
    "inventory.view",
    "inventory.manage",
    "inventory.move",
    "purchase.view",
    "purchase.request",
    "purchase.receive",
    "reports.field",
    "report.submit",
    "support.viewAll",
    "support.viewAssigned",
    "support.reply",
    "support.status",
    "support.resolve",
    "suggestion.create",
    "wiki.view",
    "wiki.contribute",
    "document.create",
    "document.edit",
    "document.share",
    "file.edit",
    "file.share",
  ),

  developer: set(
    ...BASIC,
    "project.view",
    "task.view",
    "task.edit",
    "task.updateOwn",
    "task.comment",
    "task.escalate",
    "technical.tasks",
    "support.viewAssigned",
    "support.reply",
    "support.status",
    "suggestion.create",
    "wiki.view",
    "wiki.contribute",
    "document.share",
    "file.share",
  ),

  worker: set(
    ...BASIC,
    "project.view",
    "task.view",
    "task.updateOwn",
    "task.comment",
    "inventory.view",
    "reports.field",
    "report.submit",
    "suggestion.create",
  ),

  /* Customer Service: basic employee access + support specialization.
     Deliberately EXCLUDED: roles.manage, permissions.manage, system.manage,
     finance.*, people.manage, announcement.* management, inventory/purchasing
     administration. The Owner may grant extras through Settings overrides. */
  "customer-service": set(
    ...BASIC,
    // relevant tasks & projects
    "task.view",
    "task.updateOwn",
    "task.comment",
    "project.view",
    // customer service specialized permissions
    "support.viewAll",
    "support.viewAssigned",
    "support.reply",
    "support.assign",
    "support.status",
    "support.escalate",
    "support.resolve",
    "customers.directory",
    "suggestion.create",
    "suggestion.review",
    // Support workflow may attach/share relevant files in tickets,
    // but has NO unrestricted access to organizational files.
    "document.share",
    "file.share",
  ),
};

const PERMISSION_STORAGE_KEY = "familybuild:v3:permission-overrides";

const PERMISSION_ALIASES: Partial<Record<Permission, Permission[]>> = {
  "settings.view": ["settings.personal.view"],
  "account.view": ["profile.view"],
  "message.use": ["messages.view", "messages.send"],
  "notification.use": ["notifications.view", "notifications.manage_own"],
};

export type PermissionOverrides = Partial<Record<UserRole, Partial<Record<Permission, boolean>>>>;

export function loadPermissionOverrides(): PermissionOverrides {
  return load<PermissionOverrides>(PERMISSION_STORAGE_KEY, {});
}

export function setPermissionOverride(role: UserRole, permission: Permission, value: boolean): void {
  const overrides = loadPermissionOverrides();
  const next = { ...overrides, [role]: { ...(overrides[role] ?? {}), [permission]: value } };
  save(PERMISSION_STORAGE_KEY, next);
}

function resolvePermissionCandidates(permission: Permission): Permission[] {
  const aliases = PERMISSION_ALIASES[permission] ?? [];
  return [permission, ...aliases];
}

/** Central check: may this role perform the action? */
export function can(role: UserRole, permission: Permission): boolean {
  const overrides = loadPermissionOverrides();
  const candidates = resolvePermissionCandidates(permission);

  for (const candidate of candidates) {
    const override = overrides[role]?.[candidate];
    if (override !== undefined) return override;
    if (ROLE_PERMISSIONS[role]?.has(candidate)) return true;
  }

  return false;
}

export function allPermissions(): Permission[] {
  return ALL;
}

/* ---------- Route guard ---------- */

const ALL_ROLES: UserRole[] = ["owner", "manager", "developer", "worker", "customer-service"];

export const ROUTE_ROLES: { pattern: RegExp; roles: UserRole[] }[] = [
  // Shared by every active role (basic application access)
  { pattern: /^\/$/, roles: ALL_ROLES },
  { pattern: /^\/account(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/settings(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/messages(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/notifications(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/announcements(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/suggestions(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/help(?:\/.*)?$/, roles: ALL_ROLES },

  // Projects & tasks (Customer Service sees relevant items only)
  { pattern: /^\/projects(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/tasks(?:\/.*)?$/, roles: ALL_ROLES },

  // Management / operational access
  { pattern: /^\/properties(?:\/.*)?$/, roles: ["owner", "manager"] },
  { pattern: /^\/people(?:\/.*)?$/, roles: ["owner", "manager"] },
  { pattern: /^\/inventory(?:\/.*)?$/, roles: ["owner", "manager", "worker"] },
  { pattern: /^\/purchasing(?:\/.*)?$/, roles: ["owner", "manager"] },
  { pattern: /^\/materials(?:\/.*)?$/, roles: ["worker"] },

  // Owner only
  { pattern: /^\/finance(?:\/.*)?$/, roles: ["owner"] },
  { pattern: /^\/reports(?:\/.*)?$/, roles: ["owner", "manager", "developer", "worker"] },

  // Support tickets
  { pattern: /^\/requests(?:\/.*)?$/, roles: ["owner", "manager"] },
  { pattern: /^\/problems(?:\/.*)?$/, roles: ["owner", "manager"] },
  { pattern: /^\/support(?:\/.*)?$/, roles: ["owner", "customer-service"] },
  { pattern: /^\/my-tickets(?:\/.*)?$/, roles: ["customer-service", "developer"] },
  { pattern: /^\/customers(?:\/.*)?$/, roles: ["owner", "customer-service"] },

  // Wiki access
  { pattern: /^\/wiki(?:\/.*)?$/, roles: ["owner", "manager", "developer"] },

  // Documents & Files — basic features for every role; content inside
  // is further filtered by file/document authorization.
  { pattern: /^\/documents(?:\/.*)?$/, roles: ALL_ROLES },
  { pattern: /^\/files(?:\/.*)?$/, roles: ALL_ROLES },

  // Website Management — administrative (Owner by default; the Owner
  // may grant website.* permissions to other roles via Settings).
  { pattern: /^\/website(?:\/.*)?$/, roles: ["owner"] },
];

export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  return ROUTE_ROLES.some((rule) => rule.pattern.test(pathname) && rule.roles.includes(role));
}