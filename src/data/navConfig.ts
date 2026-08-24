/* ============================================================
   FamilyBuild — Role-based navigation configuration
   ------------------------------------------------------------
   One application shell; each role gets its own sidebar.
   Sections: MAIN / KNOWLEDGE / SUPPORT / BOTTOM.
   No Pinned section, no History section.

   Active roles: owner · manager · developer · worker · customer-service.
   Documents and Files are core workspace features available to every
   role; Website Management is administrative (Owner) and lives in the
   Bottom section next to Settings.

   `indicator` marks items that show a live badge:
   - "count": actionable/unread count (Tasks [2], Messages [1])
   - "dot":   subtle warning dot (Inventory ●)
   Counts are computed from real application state in
   calculations.ts → navBadgeCounts().
   ============================================================ */

import type { NavSection, UserRole } from "./types";

const ownerNav: NavSection[] = [
  {
    label: "Main",
    entries: [
      { label: "Announcement", path: "/announcements", icon: "bell" },
      { label: "Dashboard", path: "/", icon: "overview" },
      { label: "Reports", path: "/reports", icon: "reports" },
      { label: "Messages", path: "/messages", icon: "message", indicator: "count" },
      { label: "Notifications", path: "/notifications", icon: "bell", indicator: "count" },
      { label: "Properties", path: "/properties", icon: "building" },
      { label: "Projects", path: "/projects", icon: "project" },
      { label: "Tasks", path: "/tasks", icon: "tasks", indicator: "count" },
      { label: "Documents", path: "/documents", icon: "documents" },
      { label: "Files", path: "/files", icon: "folder" },
      {
        label: "People",
        icon: "users",
        children: [
          { label: "Owners", path: "/people/owners", icon: "user" },
          { label: "Developers", path: "/people/developers", icon: "briefcase" },
          { label: "Managers", path: "/people/managers", icon: "users" },
          { label: "Workers", path: "/people/workers", icon: "users" },
          { label: "Customer Service", path: "/people/customer-service", icon: "help" },
          { label: "Unassigned Workers", path: "/people/workers?unassigned=true", icon: "alert" },
        ],
      },
      { label: "Inventory", path: "/inventory", icon: "inventory", indicator: "dot" },
      { label: "Purchasing", path: "/purchasing", icon: "purchasing", indicator: "count" },
      { label: "Finance", path: "/finance", icon: "finance" },
    ],
  },
  {
    label: "Knowledge",
    entries: [{ label: "Wiki", path: "/wiki", icon: "book" }],
  },
  {
    label: "Support",
    entries: [
      { label: "Customer Service", path: "/support", icon: "help", indicator: "count" },
      { label: "Help", path: "/help", icon: "help" },
      { label: "Suggestions", path: "/suggestions", icon: "clipboard", indicator: "count" },
    ],
  },
  {
    label: "Bottom",
    entries: [
      { label: "Website Management", path: "/website", icon: "globe" },
      { label: "Settings", path: "/settings", icon: "settings" },
      { label: "Account", path: "/account", icon: "account" },
    ],
  },
];

/* Manager keeps a focused site-leadership sidebar. */
const managerNav: NavSection[] = [
  {
    label: "Main",
    entries: [
      { label: "Announcement", path: "/announcements", icon: "bell" },
      { label: "Dashboard", path: "/", icon: "overview" },
      { label: "Reports", path: "/reports", icon: "reports" },
      { label: "Messages", path: "/messages", icon: "message", indicator: "count" },
      { label: "Notifications", path: "/notifications", icon: "bell", indicator: "count" },
      { label: "My Projects", path: "/projects", icon: "project" },
      { label: "Tasks", path: "/tasks", icon: "tasks", indicator: "count" },
      { label: "Documents", path: "/documents", icon: "documents" },
      { label: "Files", path: "/files", icon: "folder" },
      { label: "Workers", path: "/people/workers", icon: "users" },
      { label: "Properties", path: "/properties", icon: "building" },
      { label: "Inventory", path: "/inventory", icon: "inventory", indicator: "dot" },
      { label: "Purchasing", path: "/purchasing", icon: "purchasing", indicator: "count" },
    ],
  },
  {
    label: "Knowledge",
    entries: [{ label: "Wiki", path: "/wiki", icon: "book" }],
  },
  {
    label: "Bottom",
    entries: [
      { label: "Settings", path: "/settings", icon: "settings" },
      { label: "Account", path: "/account", icon: "account" },
    ],
  },
];

const developerNav: NavSection[] = [
  {
    label: "Main",
    entries: [
      { label: "Announcement", path: "/announcements", icon: "bell" },
      { label: "Dashboard", path: "/", icon: "overview" },
      { label: "Reports", path: "/reports", icon: "reports" },
      { label: "Messages", path: "/messages", icon: "message", indicator: "count" },
      { label: "Notifications", path: "/notifications", icon: "bell", indicator: "count" },
      { label: "Tasks", path: "/tasks", icon: "tasks", indicator: "count" },
      { label: "Projects", path: "/projects", icon: "project" },
      { label: "Documents", path: "/documents", icon: "documents" },
      { label: "Files", path: "/files", icon: "folder" },
    ],
  },
  {
    label: "Support",
    entries: [
      { label: "My Tickets", path: "/my-tickets", icon: "help", indicator: "count" },
      { label: "Help", path: "/help", icon: "help" },
    ],
  },
  {
    label: "Knowledge",
    entries: [{ label: "Wiki", path: "/wiki", icon: "book" }],
  },
  {
    label: "Bottom",
    entries: [
      { label: "Settings", path: "/settings", icon: "settings" },
      { label: "Account", path: "/account", icon: "account" },
    ],
  },
];

const workerNav: NavSection[] = [
  {
    label: "Main",
    entries: [
      { label: "Announcement", path: "/announcements", icon: "bell" },
      { label: "Dashboard", path: "/", icon: "overview" },
      { label: "Reports", path: "/reports", icon: "reports" },
      { label: "Messages", path: "/messages", icon: "message", indicator: "count" },
      { label: "Notifications", path: "/notifications", icon: "bell", indicator: "count" },
      { label: "My Work", path: "/", icon: "overview" },
      { label: "Tasks", path: "/tasks", icon: "tasks", indicator: "count" },
      { label: "Projects", path: "/projects", icon: "project" },
      { label: "Documents", path: "/documents", icon: "documents" },
      { label: "Files", path: "/files", icon: "folder" },
      { label: "Materials", path: "/materials", icon: "inventory" },
    ],
  },
  {
    label: "Bottom",
    entries: [
      { label: "Settings", path: "/settings", icon: "settings" },
      { label: "Account", path: "/account", icon: "account" },
    ],
  },
];

/*
 * Customer Service — basic employee access plus the specialized
 * support workflow. The "Customer Service" group mirrors the ticket
 * lifecycle (inbox → assigned → open → waiting → resolved → escalated)
 * using filtered views of the single shared support system.
 */
const customerServiceNav: NavSection[] = [
  {
    label: "Main",
    entries: [
      { label: "Announcement", path: "/announcements", icon: "bell" },
      { label: "Dashboard", path: "/", icon: "overview" },
      { label: "Messages", path: "/messages", icon: "message", indicator: "count" },
      { label: "Notifications", path: "/notifications", icon: "bell", indicator: "count" },
      { label: "My Tasks", path: "/tasks", icon: "tasks", indicator: "count" },
      { label: "Projects", path: "/projects", icon: "project" },
      { label: "Documents", path: "/documents", icon: "documents" },
      { label: "Files", path: "/files", icon: "folder" },
    ],
  },
  {
    label: "Support",
    entries: [
      { label: "Help", path: "/help", icon: "help" },
      { label: "Suggestions", path: "/suggestions", icon: "clipboard", indicator: "count" },
      {
        label: "Customer Service",
        icon: "help",
        children: [
          { label: "Support Inbox", path: "/support", icon: "help", indicator: "count" },
          { label: "Assigned Tickets", path: "/my-tickets", icon: "tasks", indicator: "count" },
          { label: "Open Tickets", path: "/support?queue=open", icon: "clipboard" },
          { label: "Waiting for Response", path: "/support?queue=waiting", icon: "clock" },
          { label: "Resolved Tickets", path: "/support?queue=resolved", icon: "check" },
          { label: "Escalations", path: "/support?queue=escalated", icon: "alert" },
          { label: "Customers", path: "/customers", icon: "users" },
        ],
      },
    ],
  },
  {
    label: "Bottom",
    entries: [
      { label: "Settings", path: "/settings", icon: "settings" },
      { label: "Account", path: "/account", icon: "account" },
    ],
  },
];

export const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  owner: ownerNav,
  manager: managerNav,
  developer: developerNav,
  worker: workerNav,
  "customer-service": customerServiceNav,
};