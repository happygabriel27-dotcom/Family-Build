/* ============================================================
   FamilyBuild — Domain Types
   Single source of truth for all entities in the application.
   ============================================================ */

/* ---------- Users & Roles ---------- */

/**
 * Active account roles (five-role model):
 * OWNER · DEVELOPER · MANAGER · WORKER · CUSTOMER SERVICE
 *
 * Legacy aliases ("builder", "property-owner") were removed from active
 * authentication/authorization. Property-owner CLIENT records still exist
 * in the people directory (PersonKind) because properties and tickets
 * reference them — they are simply no longer application accounts.
 */
export type UserRole =
  | "owner"
  | "manager"
  | "developer"
  | "worker"
  | "customer-service";

/** The five active roles in display order. */
export const ACTIVE_ROLES: UserRole[] = ["owner", "developer", "manager", "worker", "customer-service"];

export interface User {
  id: string;
  /** Links the login account to a Person record. */
  personId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  developer: "Developer",
  worker: "Worker",
  "customer-service": "Customer Service",
};

/* ---------- People ---------- */

export type PersonKind =
  | "manager"
  | "builder"
  | "developer"
  | "worker"
  | "property-owner"
  | "customer-service"
  | "admin";
export type PersonStatus = "active" | "inactive";

export interface Person {
  id: string;
  kind: PersonKind;
  name: string;
  email: string;
  phone: string;
  title: string;
  status: PersonStatus;
  /** For workers: trade/specialty. */
  specialty?: string;
  /** Project ids this person is assigned to (builders & workers). */
  projectIds?: string[];
  /** Property ids owned by this person (property owners). */
  propertyIds?: string[];
  notes?: string;
}

/* ---------- Properties ---------- */

export type PropertyType = "Residential" | "Commercial" | "Land" | "Mixed-Use";
export type PropertyStatus = "active" | "inactive" | "archived";

export interface Property {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  status: PropertyStatus;
  purchaseCost: number;
  currentValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Person id of the client who owns this property. */
  ownerId: string;
  acquiredDate: string;
  description?: string;
}

/* ---------- Projects ---------- */

export type ProjectStatus = "in-progress" | "completed" | "on-hold" | "pending";

export interface Project {
  id: string;
  name: string;
  propertyId: string;
  status: ProjectStatus;
  budget: number;
  spent: number;
  startDate: string;
  targetEndDate?: string;
  endDate?: string;
  /** Person id of the builder responsible. */
  builderId: string;
  /** Person ids of workers assigned. */
  workerIds: string[];
  progress: number;
  description?: string;
}

/* ---------- Tasks ---------- */

export type TaskStatus = "not-started" | "in-progress" | "blocked" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  kind: "photo" | "document";
  addedAt: string;
  addedBy: string;
}

export interface Task {
  id: string;
  projectId: string;
  propertyId: string;
  title: string;
  description?: string;
  /** Person id of assignee (usually a worker, may be a builder or developer). */
  assigneeId: string;
  createdById: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  progress: number; // 0–100
  comments: TaskComment[];
  attachments: TaskAttachment[];
  /** Technical/system task — visible to and manageable by Developers. */
  isTechnical?: boolean;
}

/* ---------- Service Requests & Problems (client portal) ---------- */

export type RequestKind = "request" | "problem";
export type RequestCategory =
  | "Maintenance"
  | "Plumbing"
  | "Electrical"
  | "Renovation"
  | "Structural"
  | "Billing"
  | "Other";
export type RequestStatus =
  | "submitted"
  | "under-review"
  | "assigned"
  | "in-progress"
  | "waiting"
  | "resolved"
  | "closed";

export interface RequestUpdate {
  id: string;
  authorId: string;
  text: string;
  status?: RequestStatus;
  createdAt: string;
}

export interface ServiceRequest {
  id: string;
  /** Human-facing ticket number, e.g. 1042 → displayed as "#1042". */
  ticketNo: number;
  kind: RequestKind;
  propertyId: string;
  projectId?: string;
  submittedById: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: TaskPriority;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  /** Assigned handler: customer-service agent, builder, or developer. */
  assignedToId?: string;
  /** Escalation target when a ticket needs technical or management attention. */
  escalatedToId?: string;
  escalationReason?: string;
  escalatedAt?: string;
  updates: RequestUpdate[];
}

/* ---------- Inventory ---------- */

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  /**
   * Opening quantity at the start of the ledger. Current quantity is always
   * derived: opening + stockIn − stockOut + adjustments (see calculations.ts).
   */
  openingQuantity: number;
  unit: string;
  minStock: number;
  costPerUnit: number;
  supplier: string;
  location: string;
}

/* ---------- Inventory stock movements ---------- */

export type StockMovementKind = "stock-in" | "stock-out" | "adjustment" | "transfer-in" | "transfer-out";

export interface InventoryTransaction {
  id: string;
  itemId: string;
  kind: StockMovementKind;
  /** Signed delta applied to stock: positive adds, negative removes. */
  quantityDelta: number;
  reason?: string;
  actorId?: string;
  date: string;
  /** Set when this movement originated from a received purchase order. */
  purchaseOrderId?: string;
}

/* ---------- Purchasing ---------- */

export type PurchaseOrderStatus =
  | "draft"
  | "pending" // requested — awaiting owner approval
  | "approved"
  | "purchased" // ordered/paid with the supplier, awaiting delivery
  | "rejected"
  | "delivered" // received — stock added + expense recorded
  | "cancelled";

export interface PurchaseOrderItem {
  inventoryItemId?: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  items: PurchaseOrderItem[];
  total: number;
  status: PurchaseOrderStatus;
  date: string;
  projectId?: string;
  requestedById: string;
  notes?: string;
  /** Finance transaction recorded when the delivery was received. */
  receivedTxId?: string;
}

/* ---------- Finance ---------- */

export type TransactionStatus = "active" | "cancelled";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  propertyId?: string;
  projectId?: string;
  /** Cancelled transactions are excluded from all active totals. */
  status: TransactionStatus;
  /** Set when this transaction was auto-recorded by a purchase delivery. */
  purchaseOrderId?: string;
}

/* ---------- Files ----------
   Central file-metadata record. Binary payloads are NOT stored in the
   UI layer: `storageKey` is the seam a real backend replaces with an
   object-storage reference, and `dataUrl` optionally carries a small
   inline preview (demo builds only). */

export type FileKind = "image" | "pdf" | "spreadsheet" | "document" | "archive" | "other";

/**
 * Authorization scope of a file. Access follows the parent object:
 *  - private:      uploader (+ Owner oversight)
 *  - project:      project builder & assigned workers (+ Owner/Manager)
 *  - task:         task assignee & creator (+ Owner/Manager)
 *  - conversation: strictly the conversation participants
 *  - organization: every authenticated member
 */
export type FileVisibility = "private" | "project" | "task" | "conversation" | "organization";

export interface FileRecord {
  id: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedAt: string;
  updatedAt: string;
  description?: string;
  visibility: FileVisibility;
  projectId?: string;
  taskId?: string;
  conversationId?: string;
  /** Mock storage reference — swap for a real object-storage key later. */
  storageKey: string;
  /** Small inline preview payload (images in demo mode only). */
  dataUrl?: string;
}

/* ---------- Documents ----------
   A document is the organizational wrapper around optional file
   content: title/description/category/owner plus an optional link to
   a FileRecord and to a related project/property. */

export interface DocumentRecord {
  id: string;
  title: string;
  description?: string;
  category: string;
  /** Person id of the document owner/creator. */
  ownerById: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  /** Optional linked physical file (FileRecord id). */
  fileId?: string;
  projectId?: string;
  propertyId?: string;
}

/* ---------- Work Reports (field reports by workers) ---------- */

export interface WorkReport {
  id: string;
  projectId: string;
  authorId: string;
  taskId?: string;
  title: string;
  notes: string;
  date: string;
  photos: string[]; // mock photo labels
}

/* ---------- Messages ---------- */

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  readBy: string[];
  /** Attached files (references into the files collection). */
  attachments?: Array<{ fileId: string }>;
  /** Soft-delete tombstone — content is scrubbed when set. */
  deleted?: boolean;
}

export type ConversationKind = "direct" | "group";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  participantIds: string[];
  /** Direct: thread subject. Group: the group name. */
  subject: string;
  propertyId?: string;
  messages: Message[];
  updatedAt: string;
  /* ----- group-only fields ----- */
  /** Person id of the group creator (implicit admin). */
  createdById?: string;
  createdAt?: string;
  /** Person ids with group-admin rights (rename/add/remove members). */
  adminIds?: string[];
  /** Optional small group image (data URL in demo mode). */
  image?: string;
}

/* ---------- Announcements ---------- */

export type AnnouncementAudience =
  | "EVERYONE"
  | "DEVELOPERS"
  | "WORKERS"
  | "CUSTOMER_SERVICE";

export type AnnouncementStatus = "draft" | "published" | "archived";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  createdAt: string;
  publishedAt?: string;
  expiresAt?: string;
}

/* ---------- Suggestions / feedback ---------- */

export type SuggestionCategory = "Feature Idea" | "Improvement" | "Bug Report" | "Process" | "Other";
export type SuggestionStatus = "new" | "under-review" | "planned" | "completed" | "declined";

export interface Suggestion {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  status: SuggestionStatus;
  createdAt: string;
  response?: string;
}

/* ---------- Notifications ---------- */

export type NotificationType =
  | "task-assigned"
  | "task-completed"
  | "task-updated"
  | "purchase-submitted"
  | "purchase-approved"
  | "purchase-rejected"
  | "purchase-received"
  | "request-new"
  | "request-update"
  | "issue-reported"
  | "issue-resolved"
  | "ticket-assigned"
  | "ticket-escalated"
  | "message"
  | "project-update"
  | "announcement"
  | "low-stock"
  | "suggestion-update"
  | "system";

export interface AppNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  createdAt: string;
  read: boolean;
}

/* ---------- Activity (business audit trail) ---------- */

export type ActivityColor = "success" | "warning" | "danger" | "info" | "neutral";

export interface ActivityEvent {
  id: string;
  type:
    | "property"
    | "project"
    | "task"
    | "finance"
    | "request"
    | "inventory"
    | "purchase"
    | "people"
    | "wiki"
    | "message"
    | "announcement"
    | "suggestion";
  text: string;
  actorId?: string;
  createdAt: string;
  color: ActivityColor;
  propertyId?: string;
  projectId?: string;
}

/* ---------- Wiki ---------- */

export interface WikiCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface WikiArticle {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  /** Simple markdown-ish content: # headings, - lists, blank-line paragraphs. */
  content: string;
  tags: string[];
  authorId: string;
  updatedAt: string;
  relatedIds: string[];
}

/* ---------- Website settings (centralized branding) ----------
   Single source of truth for application identity. Rendered by the
   Sidebar, authentication pages, and document head — never hard-coded
   in individual components. Branding controls ONLY identity assets;
   application UI colors are owned by the fixed design system. */

/**
 * How the logo's own container is rendered behind the logo image.
 * Strictly scoped to the logo — never a global theme control.
 *  - original:    display the uploaded image exactly as provided
 *  - transparent: no additional background (for transparent PNGs)
 *  - custom:      a user-chosen background color for the logo only
 */
export type LogoBackgroundMode = "original" | "transparent" | "custom";

/** Default preserves existing logos after this feature was added. */
export const DEFAULT_LOGO_BACKGROUND_MODE: LogoBackgroundMode = "original";

/** Default custom color if none chosen yet. */
export const DEFAULT_LOGO_BACKGROUND_COLOR = "#374151";

/**
 * How the browser-tab favicon is produced.
 *  - automatic: derived from branding assets (custom favicon wins later
 *    if one is uploaded); adapts ONLY the favicon to the browser's
 *    light/dark environment — never the website.
 *  - custom:    a dedicated uploaded favicon overrides everything.
 */
export type FaviconMode = "automatic" | "custom";

/** Default keeps existing sites on their current favicon behavior. */
export const DEFAULT_FAVICON_MODE: FaviconMode = "automatic";

export interface WebsiteSettings {
  brandName: string;
  subBrandName: string;
  /** Letter-mark fallback shown when no logo image is configured. */
  logoText: string;
  /** Optional logo image (small data URL in demo mode). Transparent
      backgrounds are supported as-is; the logo never drives theming. */
  logoDataUrl?: string;
  /** How the logo's own container is rendered. Scoped to the logo
      only — never a global theme control. Defaults to "original". */
  logoBackgroundMode?: LogoBackgroundMode;
  /** Background color used when logoBackgroundMode === "custom". */
  logoBackgroundColor?: string;
  /** How the browser-tab favicon is produced. Defaults to "automatic".
      Entirely independent of the main logo, logo background, and theme. */
  faviconMode?: FaviconMode;
  /** Dedicated favicon upload (small data URL). Used only when
      faviconMode === "custom"; overrides the automatic variant. */
  faviconDataUrl?: string;
  /** Browser-tab / application title. */
  title: string;
  shortDescription: string;
  organizationName: string;
  /** Login page tagline shown under the brand lockup. */
  loginTagline: string;
  updatedAt: string;
}

/* ---------- Navigation ---------- */

export interface NavLeaf {
  label: string;
  path: string;
  icon: string;
  /**
   * Optional live indicator rendered next to the item:
   *  - "count": actionable/unread item count (e.g. Tasks [2])
   *  - "dot":   subtle warning dot (e.g. Inventory ●)
   */
  indicator?: "count" | "dot";
}

export interface NavGroup {
  label: string;
  icon: string;
  children: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

export interface NavSection {
  label: string;
  entries: NavEntry[];
}

/* ---------- Helpers ---------- */

/** Stock status from an explicit current quantity (see calculations.ts). */
export function stockStatusFromQuantity(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) return "out-of-stock";
  if (quantity <= minStock) return "low-stock";
  return "in-stock";
}

export function isOverdue(task: Pick<Task, "dueDate" | "status">): boolean {
  return (
    task.status !== "completed" &&
    task.status !== "cancelled" &&
    new Date(task.dueDate).getTime() < Date.now()
  );
}