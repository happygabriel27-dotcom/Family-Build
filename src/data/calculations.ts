/* ============================================================
   FamilyBuild — Centralized Business Calculations
   ------------------------------------------------------------
   ALL derived business values live here, not in UI components:
   - Inventory: current stock from opening + movement ledger
   - Finance:   income/expense/net from active transactions
   - Navigation badges: actionable/unread counts per role
   UI pages call these functions with data from DataContext.
   When a real backend exists these can move server-side.
   ============================================================ */

import type {
  Announcement,
  AppNotification,
  Conversation,
  InventoryItem,
  InventoryTransaction,
  Person,
  PurchaseOrder,
  ServiceRequest,
  StockStatus,
  Suggestion,
  Task,
  Transaction,
  User,
} from "./types";
import { isOverdue } from "./types";

/* ================= INVENTORY ================= */

export interface StockLevel {
  opening: number;
  stockIn: number;
  stockOut: number;
  adjustments: number;
  /** opening + stockIn − stockOut + adjustments (never below 0). */
  current: number;
}

/**
 * currentQuantity = openingQuantity + stockIn − stockOut + adjustments
 * Computed purely from the movement ledger — never stored by hand.
 */
export function computeStockLevel(
  item: Pick<InventoryItem, "id" | "openingQuantity">,
  movements: InventoryTransaction[],
): StockLevel {
  let stockIn = 0;
  let stockOut = 0;
  let adjustments = 0;
  for (const m of movements) {
    if (m.itemId !== item.id) continue;
    if (m.kind === "stock-in" || m.kind === "transfer-in") stockIn += m.quantityDelta;
    else if (m.kind === "stock-out" || m.kind === "transfer-out") stockOut += m.quantityDelta;
    else adjustments += m.quantityDelta;
  }
  const current = Math.max(0, item.openingQuantity + stockIn + stockOut + adjustments);
  return { opening: item.openingQuantity, stockIn, stockOut, adjustments, current };
}

export function stockStatusFor(level: StockLevel, minStock: number): StockStatus {
  if (level.current <= 0) return "out-of-stock";
  if (level.current <= minStock) return "low-stock";
  return "in-stock";
}

/** Convenience: status for an item given the full ledger. */
export function itemStockStatus(
  item: InventoryItem,
  movements: InventoryTransaction[],
): { level: StockLevel; status: StockStatus } {
  const level = computeStockLevel(item, movements);
  return { level, status: stockStatusFor(level, item.minStock) };
}

/** Items at or below minimum stock (the low-stock warning set). */
export function lowStockItems(
  inventory: InventoryItem[],
  movements: InventoryTransaction[],
): Array<{ item: InventoryItem; level: StockLevel; status: StockStatus }> {
  return inventory
    .map((item) => ({ item, ...itemStockStatus(item, movements) }))
    .filter((x) => x.status !== "in-stock");
}

/* ================= FINANCE ================= */

export interface FinanceTotals {
  income: number;
  expenses: number;
  net: number;
}

const isActive = (t: Transaction) => t.status !== "cancelled";

/** Totals come ONLY from active transactions — cancelled are excluded. */
export function financeTotals(transactions: Transaction[]): FinanceTotals {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (!isActive(t)) continue;
    if (t.type === "income") income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses, net: income - expenses };
}

export function activeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(isActive);
}

/* ================= PURCHASING ================= */

/** Purchase requests awaiting owner approval. */
export function pendingPurchaseOrders(orders: PurchaseOrder[]): PurchaseOrder[] {
  return orders.filter((o) => o.status === "pending");
}

/* ================= SUPPORT / TICKETS ================= */

const OPEN_TICKET_STATUSES = ["submitted", "under-review", "assigned", "in-progress", "waiting"];

export function isOpenTicket(t: ServiceRequest): boolean {
  return OPEN_TICKET_STATUSES.includes(t.status);
}

/** Tickets in the CS inbox that still need action (not resolved/closed). */
export function openTickets(requests: ServiceRequest[]): ServiceRequest[] {
  return requests.filter(isOpenTicket);
}

/** Unassigned tickets waiting for a CS agent to pick up. */
export function unassignedTickets(requests: ServiceRequest[]): ServiceRequest[] {
  return openTickets(requests).filter((t) => !t.assignedToId);
}

/** Open tickets assigned to a specific person. */
export function ticketsAssignedTo(requests: ServiceRequest[], personId: string): ServiceRequest[] {
  return openTickets(requests).filter((t) => t.assignedToId === personId);
}

/** Open tickets escalated to a specific person (e.g. developer/owner). */
export function ticketsEscalatedTo(requests: ServiceRequest[], personId: string): ServiceRequest[] {
  return openTickets(requests).filter((t) => t.escalatedToId === personId);
}

/* ================= TASKS ================= */

/** Tasks requiring attention of their assignee: overdue or blocked. */
export function tasksNeedingAttention(tasks: Task[]): Task[] {
  return tasks.filter((t) => isOverdue(t) || t.status === "blocked");
}

/* ================= MESSAGES ================= */

/** Conversations where someone else sent messages I haven't read. */
export function conversationsWithUnread(conversations: Conversation[], myPersonId: string): Conversation[] {
  return conversations.filter((c) =>
    c.participantIds.includes(myPersonId) &&
    c.messages.some((m) => m.senderId !== myPersonId && !m.readBy.includes(myPersonId)),
  );
}

/** Total unread incoming message count across conversations. */
export function unreadMessageCount(conversations: Conversation[], myPersonId: string): number {
  return conversationsWithUnread(conversations, myPersonId).reduce(
    (sum, c) => sum + c.messages.filter((m) => m.senderId !== myPersonId && !m.readBy.includes(myPersonId)).length,
    0,
  );
}

/* ================= NOTIFICATIONS ================= */

export function unreadNotifications(notifications: AppNotification[], myPersonId: string): AppNotification[] {
  return notifications.filter((n) => n.recipientId === myPersonId && !n.read);
}

/* ================= ANNOUNCEMENTS ================= */

function roleMatchesAudience(role: User["role"], audience: Announcement["audience"]): boolean {
  switch (audience) {
    case "EVERYONE":
      return true;
    case "DEVELOPERS":
      return role === "developer" || role === "owner";
    case "WORKERS":
      return role === "worker" || role === "owner";
    case "CUSTOMER_SERVICE":
      return role === "customer-service" || role === "owner";
    default:
      return false;
  }
}

/** Published announcements visible to this role (respects expiry). */
export function announcementsForRole(announcements: Announcement[], role: User["role"]): Announcement[] {
  const now = Date.now();
  return announcements
    .filter((a) => {
      if (a.status !== "published") return false;
      if (!roleMatchesAudience(role, a.audience)) return false;
      if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return false;
      return true;
    })
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
}

/* ================= SUGGESTIONS ================= */

export function pendingSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter((s) => s.status === "new" || s.status === "under-review");
}

/* ================= NAVIGATION BADGES ================= */

export interface NavBadge {
  count?: number;
  dot?: boolean;
}

/**
 * Live sidebar indicators computed from real application state.
 * Counts represent ACTIONABLE items, not totals:
 *  - Tasks: overdue/blocked for managers; due-today-or-overdue for workers;
 *           open technical tasks assigned to me for developers.
 *  - Messages: conversations with unread incoming messages.
 *  - Notifications: unread notifications.
 *  - Purchasing: pending approvals (owner/builder).
 *  - Support inbox: open tickets (CS/owner).
 *  - My tickets: open tickets assigned or escalated to me.
 *  - Requests/Problems (property owner): own open items.
 *  - Suggestions: pending review (owner/CS).
 *  - Inventory: dot when anything is low/out of stock.
 */
export function navBadgeCounts(input: {
  user: User | null;
  people: Person[];
  tasks: Task[];
  requests: ServiceRequest[];
  purchaseOrders: PurchaseOrder[];
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  conversations: Conversation[];
  notifications: AppNotification[];
  suggestions: Suggestion[];
}): Record<string, NavBadge> {
  const { user } = input;
  if (!user) return {};

  const me = input.people.find((p) => p.id === user.personId);
  const myId = me?.id ?? "";
  const role = user.role;
  const badges: Record<string, NavBadge> = {};

  /* Tasks needing MY attention */
  let attentionTasks: Task[] = [];
  if (role === "worker" || role === "customer-service") {
    const today = new Date().toISOString().slice(0, 10);
    attentionTasks = input.tasks.filter(
      (t) => t.assigneeId === myId && t.dueDate <= today && t.status !== "completed" && t.status !== "cancelled",
    );
  } else if (role === "developer") {
    attentionTasks = input.tasks.filter(
      (t) =>
        t.isTechnical &&
        t.assigneeId === myId &&
        t.status !== "completed" &&
        t.status !== "cancelled",
    );
  } else if (role === "owner") {
    attentionTasks = tasksNeedingAttention(input.tasks);
  } else if (role === "manager" && me?.projectIds?.length) {
    const ids = new Set(me.projectIds);
    attentionTasks = tasksNeedingAttention(input.tasks.filter((t) => ids.has(t.projectId)));
  }

  if (attentionTasks.length > 0) badges["/tasks"] = { count: attentionTasks.length };

  /* Messages */
  const unreadConvs = conversationsWithUnread(input.conversations, myId);
  if (unreadConvs.length > 0) badges["/messages"] = { count: unreadMessageCount(input.conversations, myId) };

  /* Notifications */
  const unreadNtf = unreadNotifications(input.notifications, myId);
  if (unreadNtf.length > 0) badges["/notifications"] = { count: unreadNtf.length };

  /* Purchasing approvals */
  if (role === "owner" || role === "manager") {
    const pending = pendingPurchaseOrders(input.purchaseOrders);
    if (pending.length > 0) badges["/purchasing"] = { count: pending.length };
  }

  /* Support inbox (CS + owner) */
  if (role === "customer-service" || role === "owner") {
    const open = openTickets(input.requests);
    if (open.length > 0) badges["/support"] = { count: open.length };
  }

  /* My tickets (CS agents & developers) */
  if (role === "customer-service" || role === "developer") {
    const mine = [
      ...ticketsAssignedTo(input.requests, myId),
      ...ticketsEscalatedTo(input.requests, myId),
    ];
    const unique = Array.from(new Set(mine.map((t) => t.id))).length;
    if (unique > 0) badges["/my-tickets"] = { count: unique };
  }

  /* Suggestions awaiting review */
  if (role === "owner" || role === "customer-service") {
    const pending = pendingSuggestions(input.suggestions);
    if (pending.length > 0) badges["/suggestions"] = { count: pending.length };
  }

  /* Inventory warning dot */
  if (role === "owner" || role === "manager") {
    const low = lowStockItems(input.inventory, input.inventoryTransactions);
    if (low.length > 0) badges["/inventory"] = { dot: true };
  }

  return badges;
}