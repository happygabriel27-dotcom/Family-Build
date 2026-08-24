/* ============================================================
   FamilyBuild — Settings (administrative)
   ------------------------------------------------------------
   Owner-controlled role/permission configuration. Permission
   categories are separated into:
     - Basic Application Permissions (every role)
     - Customer Service Permissions (support workflow)
     - Administrative Permissions (owner unless granted)
   Website Management permissions (website.*) default to Owner and can
   be granted to other roles here.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { listUsers } from "../services/authService";
import { can, setPermissionOverride, type Permission } from "../data/permissions";
import { ACTIVE_ROLES, ROLE_LABELS, type UserRole } from "../data/types";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export function SettingsPage() {
  const { user, demoSignIn, showToast } = useApp();
  const data = useData();
  const [resetOpen, setResetOpen] = useState(false);

  if (!user) return null;

  const activeRoles = ACTIVE_ROLES;
  const accounts = listUsers();

  const announcementPermissions: Permission[] = [
    "announcement.view",
    "announcement.create",
    "announcement.edit",
    "announcement.publish",
    "announcement.delete",
  ];

  /* Separated permission groups per the authorization model. */
  const permissionCategories = useMemo<Array<{ label: string; permissions: Permission[] }>>(
    () => [
      {
        label: "Basic · User settings",
        permissions: ["profile.view", "profile.edit", "settings.personal.view", "settings.view"],
      },
      {
        label: "Basic · Features",
        permissions: [
          "dashboard.view",
          "messages.view",
          "messages.send",
          "notifications.view",
          "notifications.manage_own",
          "announcement.view",
          "help.view",
        ],
      },
      {
        label: "Customer Service · Support workflow",
        permissions: [
          "support.viewAll",
          "support.viewAssigned",
          "support.reply",
          "support.assign",
          "support.status",
          "support.escalate",
          "support.resolve",
          "customers.directory",
        ],
      },
      {
        label: "Customer Service · Tasks & projects",
        permissions: ["task.view", "task.updateOwn", "task.comment", "project.view"],
      },
      {
        label: "Administrative · Announcements",
        permissions: announcementPermissions,
      },
      {
        label: "Administrative · People & users",
        permissions: ["people.view", "people.manage", "users.view", "users.create", "users.edit", "users.delete"],
      },
      {
        label: "Administrative · System",
        permissions: ["settings.admin.view", "permissions.manage", "roles.manage", "system.manage"],
      },
      {
        label: "Administrative · Finance",
        permissions: ["finance.view", "finance.manage"],
      },
      {
        label: "Administrative · Inventory",
        permissions: ["inventory.view", "inventory.manage", "inventory.move"],
      },
      {
        label: "Administrative · Purchasing",
        permissions: ["purchase.view", "purchase.request", "purchase.approve", "purchase.receive"],
      },
      {
        label: "Basic · Documents & Files",
        permissions: ["document.view", "file.view", "file.upload"],
      },
      {
        label: "Documents & Files · Sharing",
        permissions: ["document.share", "file.share"],
      },
      {
        label: "Administrative · Documents & Files",
        permissions: [
          "document.create",
          "document.edit",
          "document.delete",
          "file.edit",
          "file.delete",
        ],
      },
      {
        label: "Administrative · Website Management",
        permissions: [
          "website.view",
          "website.branding.edit",
          "website.content.edit",
        ],
      },
      {
        label: "Administrative · Tasks",
        permissions: ["task.create", "task.edit", "task.assign", "task.delete"],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const togglePermission = (role: UserRole, permission: Permission) => {
    const next = !can(role, permission);
    setPermissionOverride(role, permission, next);
    showToast(`${ROLE_LABELS[role]} ${permission.replace(".", " ")} ${next ? "enabled" : "disabled"}`, "info");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Settings</h1>
          <p className="page-header__subtitle">Administrative configuration and role-based access.</p>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Account</h2>
            <p className="card__subtitle">Your current session</p>
          </div>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-item__label">Name</div>
            <div className="info-item__value">{user.name}</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Email</div>
            <div className="info-item__value">{user.email}</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Role</div>
            <div className="info-item__value">{ROLE_LABELS[user.role]}</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Title</div>
            <div className="info-item__value">{user.title}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Permissions</h2>
            <p className="card__subtitle">
              Owner-controlled access grouped by Basic Application, Customer Service,
              and Administrative permission sets.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Permission</th>
                  {activeRoles.map((role) => (
                    <th key={role}>{ROLE_LABELS[role]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionCategories.flatMap((group) =>
                  group.permissions.map((permission) => (
                    <tr key={`${group.label}-${permission}`}>
                      <td>{group.label} · {permission.replace(".", " ")}</td>
                      {activeRoles.map((role) => (
                        <td key={`${role}-${permission}`}>
                          <button
                            type="button"
                            className={`btn btn--sm ${can(role, permission) ? "btn--primary" : "btn--ghost"}`}
                            onClick={() => togglePermission(role, permission)}
                          >
                            {can(role, permission) ? "Allowed" : "Blocked"}
                          </button>
                        </td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Announcement management</h2>
            <p className="card__subtitle">
              Owner can determine who may view, create, edit, publish, or delete announcements.
              Customer Service has view-only access by default.
            </p>
          </div>
        </div>
        <div className="role-options">
          {activeRoles.map((role) => (
            <div key={role} className="card" style={{ padding: 12 }}>
              <div className="role-option__header">
                <strong>{ROLE_LABELS[role]}</strong>
              </div>
              <div className="checkbox-row" style={{ marginTop: 12 }}>
                {announcementPermissions.map((permission) => (
                  <label key={`${role}-${permission}`} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={can(role, permission)}
                      onChange={() => togglePermission(role, permission)}
                    />
                    {permission.replace("announcement.", "")}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Switch demo role</h2>
            <p className="card__subtitle">
              Development tool — jump between registered accounts to test role-based views.
              Not available in production.
            </p>
          </div>
        </div>
        <div className="role-options">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className={`role-option ${user.id === account.id ? "role-option--active" : ""}`}
              onClick={() => {
                demoSignIn(account.id);
                showToast(`Switched to ${account.name} (${ROLE_LABELS[account.role]})`, "success");
              }}
            >
              <div className="role-option__header">
                <strong>{ROLE_LABELS[account.role]}</strong>
                {user.id === account.id && <span className="badge badge--success">Current</span>}
              </div>
              <p>
                {account.name} — {account.email}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Demo data</h2>
            <p className="card__subtitle">
              All business data is mock data persisted in your browser's local storage
              ({Object.keys(data).length} collections). Resetting restores the original seed.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn--danger" onClick={() => setResetOpen(true)}>
          Reset demo data
        </button>
      </div>

      {resetOpen && (
        <ConfirmDialog
          title="Reset demo data?"
          message="All changes you made (tasks, requests, messages, etc.) will be discarded and the original seed data restored. You will stay signed in."
          confirmLabel="Reset everything"
          danger
          onConfirm={() => {
            data.resetDemoData();
            showToast("Demo data has been reset", "success");
          }}
          onCancel={() => undefined}
        />
      )}
    </div>
  );
}