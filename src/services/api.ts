/* ============================================================
   FamilyBuild — Data Service (mock backend)
   ------------------------------------------------------------
   Loads the full dataset from localStorage, seeding it from
   mock data on first run. Every collection is persisted after
   each mutation so state survives page refreshes.

   To connect a real database later:
   1. Replace `fetchAll` with an API call.
   2. Replace `persistCollection` with create/update endpoints.
   The DataContext and UI layers stay unchanged.
   ============================================================ */

import {
  activitySeed,
  announcementsSeed,
  conversationsSeed,
  DEMO_ACCOUNTS,
  documentsSeed,
  filesSeed,
  inventorySeed,
  inventoryTransactionsSeed,
  notificationsSeed,
  peopleSeed,
  propertiesSeed,
  projectsSeed,
  purchaseOrdersSeed,
  requestsSeed,
  suggestionsSeed,
  tasksSeed,
  transactionsSeed,
  workReportsSeed,
} from "../data/mockData";
import { wikiArticlesSeed, wikiCategoriesSeed } from "../data/wikiSeed";
import type {
  ActivityEvent,
  Announcement,
  AppNotification,
  Conversation,
  DocumentRecord,
  FileRecord,
  InventoryItem,
  InventoryTransaction,
  Person,
  Project,
  Property,
  PurchaseOrder,
  ServiceRequest,
  Suggestion,
  Task,
  Transaction,
  User,
  WikiArticle,
  WikiCategory,
  WorkReport,
} from "../data/types";
import { SEED_VERSION, STORAGE_KEYS, clearAll, load, save } from "./storage";

export interface AppData {
  people: Person[];
  properties: Property[];
  projects: Project[];
  tasks: Task[];
  requests: ServiceRequest[];
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  purchaseOrders: PurchaseOrder[];
  transactions: Transaction[];
  workReports: WorkReport[];
  announcements: Announcement[];
  suggestions: Suggestion[];
  conversations: Conversation[];
  documents: DocumentRecord[];
  files: FileRecord[];
  notifications: AppNotification[];
  activity: ActivityEvent[];
  wikiCategories: WikiCategory[];
  wikiArticles: WikiArticle[];
}

function seedData(): AppData {
  return {
    people: peopleSeed,
    properties: propertiesSeed,
    projects: projectsSeed,
    tasks: tasksSeed,
    requests: requestsSeed,
    inventory: inventorySeed,
    inventoryTransactions: inventoryTransactionsSeed,
    purchaseOrders: purchaseOrdersSeed,
    transactions: transactionsSeed,
    workReports: workReportsSeed,
    announcements: announcementsSeed,
    suggestions: suggestionsSeed,
    conversations: conversationsSeed,
    documents: documentsSeed,
    files: filesSeed,
    notifications: notificationsSeed,
    activity: activitySeed,
    wikiCategories: wikiCategoriesSeed,
    wikiArticles: wikiArticlesSeed,
  };
}

/**
 * Normalizes records persisted by an older seed version so new required
 * fields always exist (e.g. ticketNo on requests, status on transactions).
 */
function normalize(data: AppData): AppData {
  let nextTicket = 1046;
  const existingNos = new Set(data.requests.map((r) => r.ticketNo));
  while (existingNos.has(nextTicket)) nextTicket += 1;

  const requests = data.requests.map((r) => ({
    ...r,
    ticketNo: r.ticketNo ?? nextTicket++,
    updates: r.updates ?? [],
  }));

  const transactions = data.transactions.map((t) => ({ ...t, status: t.status ?? "active" }));
  const inventoryTransactions = data.inventoryTransactions ?? [];

  /* Conversations persisted before group support default to "direct". */
  const conversations = (data.conversations ?? []).map((c) => ({
    ...c,
    kind: c.kind ?? ("direct" as const),
  }));

  const documents = data.documents ?? [];
  const files = data.files ?? [];

  return { ...data, requests, transactions, inventoryTransactions, conversations, documents, files };
}

/** Reads all collections; seeds localStorage on first run or version change. */
export function fetchAll(): AppData {
  const seededVersion = load<string | null>(STORAGE_KEYS.seeded, null);
  if (seededVersion !== SEED_VERSION) {
    const fresh = seedData();
    persistAll(fresh);
    save(STORAGE_KEYS.seeded, SEED_VERSION);
    return fresh;
  }
  return normalize({
    people: load<Person[]>(STORAGE_KEYS.people, peopleSeed),
    properties: load<Property[]>(STORAGE_KEYS.properties, propertiesSeed),
    projects: load<Project[]>(STORAGE_KEYS.projects, projectsSeed),
    tasks: load<Task[]>(STORAGE_KEYS.tasks, tasksSeed),
    requests: load<ServiceRequest[]>(STORAGE_KEYS.requests, requestsSeed),
    inventory: load<InventoryItem[]>(STORAGE_KEYS.inventory, inventorySeed),
    inventoryTransactions: load<InventoryTransaction[]>(
      STORAGE_KEYS.inventoryTransactions,
      inventoryTransactionsSeed,
    ),
    purchaseOrders: load<PurchaseOrder[]>(STORAGE_KEYS.purchaseOrders, purchaseOrdersSeed),
    transactions: load<Transaction[]>(STORAGE_KEYS.transactions, transactionsSeed),
    workReports: load<WorkReport[]>(STORAGE_KEYS.workReports, workReportsSeed),
    announcements: load<Announcement[]>(STORAGE_KEYS.announcements, announcementsSeed),
    suggestions: load<Suggestion[]>(STORAGE_KEYS.suggestions, suggestionsSeed),
    conversations: load<Conversation[]>(STORAGE_KEYS.conversations, conversationsSeed),
    documents: load<DocumentRecord[]>(STORAGE_KEYS.documents, documentsSeed),
    files: load<FileRecord[]>(STORAGE_KEYS.files, filesSeed),
    notifications: load<AppNotification[]>(STORAGE_KEYS.notifications, notificationsSeed),
    activity: load<ActivityEvent[]>(STORAGE_KEYS.activity, activitySeed),
    wikiCategories: load<WikiCategory[]>(STORAGE_KEYS.wikiCategories, wikiCategoriesSeed),
    wikiArticles: load<WikiArticle[]>(STORAGE_KEYS.wikiArticles, wikiArticlesSeed),
  });
}

export function persistCollection<K extends keyof AppData>(key: K, value: AppData[K]): void {
  save(STORAGE_KEYS[key], value);
}

function persistAll(data: AppData): void {
  (Object.keys(data) as (keyof AppData)[]).forEach((key) => persistCollection(key, data[key]));
}

/** Wipes everything and reseeds — used by Settings → Reset demo data. */
export function resetDatabase(): AppData {
  clearAll();
  const fresh = seedData();
  persistAll(fresh);
  save(STORAGE_KEYS.seeded, SEED_VERSION);
  return fresh;
}

/* ---------- Current user (demo auth) ---------- */

export function loadCurrentUser(): User | null {
  return load<User | null>(STORAGE_KEYS.user, null);
}

export function saveCurrentUser(user: User | null): void {
  if (user) save(STORAGE_KEYS.user, user);
  else removeUser();
}

function removeUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch {
    // ignore
  }
}

export { DEMO_ACCOUNTS };