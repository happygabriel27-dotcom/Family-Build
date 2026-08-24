/* ============================================================
   FamilyBuild — Data Context
   ------------------------------------------------------------
   Holds every business collection in React state, persisted
   through the service layer on each mutation. Also owns the
   cross-cutting concerns: activity logging and notifications.
   UI components never touch localStorage directly and never
   compute business values themselves — they call the mutators
   here and read derived values from data/calculations.ts.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchAll, persistCollection, resetDatabase, type AppData } from "../services/api";
import { computeStockLevel, itemStockStatus } from "../data/calculations";
import type {
  ActivityColor,
  ActivityEvent,
  Announcement,
  AnnouncementAudience,
  AppNotification,
  Conversation,
  DocumentRecord,
  FileRecord,
  InventoryItem,
  InventoryTransaction,
  NotificationType,
  Person,
  Project,
  Property,
  PurchaseOrder,
  PurchaseOrderStatus,
  ServiceRequest,
  StockMovementKind,
  Suggestion,
  SuggestionCategory,
  SuggestionStatus,
  Task,
  TaskAttachment,
  TaskComment,
  Transaction,
  TransactionStatus,
  User,
  WikiArticle,
  WorkReport,
} from "../data/types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface NewTaskInput {
  projectId: string;
  title: string;
  description?: string;
  assigneeId: string;
  priority: Task["priority"];
  dueDate: string;
  createdById: string;
  isTechnical?: boolean;
}

export interface NewRequestInput {
  kind: ServiceRequest["kind"];
  propertyId: string;
  projectId?: string;
  submittedById: string;
  title: string;
  description: string;
  category: ServiceRequest["category"];
  priority: ServiceRequest["priority"];
}

export interface NewAnnouncementInput {
  title: string;
  content: string;
  authorId: string;
  audience: AnnouncementAudience;
  expiresAt?: string;
}

interface DataContextType extends AppData {
  /* lookups */
  personById: (id: string) => Person | undefined;
  propertyById: (id: string) => Property | undefined;
  projectById: (id: string) => Project | undefined;
  actorName: (personId: string) => string;

  /* properties */
  addProperty: (input: Omit<Property, "id">) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  deleteProperty: (id: string) => void;

  /* projects */
  addProject: (input: Omit<Project, "id">) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  /* tasks */
  addTask: (input: NewTaskInput) => Task;
  updateTask: (id: string, patch: Partial<Task>, actorId: string) => void;
  addTaskComment: (taskId: string, authorId: string, text: string) => void;
  addTaskAttachment: (taskId: string, attachment: Omit<TaskAttachment, "id">) => void;
  deleteTask: (id: string) => void;

  /* support tickets (requests / problems) */
  addRequest: (input: NewRequestInput) => ServiceRequest;
  updateRequestStatus: (
    id: string,
    status: ServiceRequest["status"],
    actorId: string,
    note?: string,
    assignedToId?: string,
  ) => void;
  assignTicket: (id: string, assignedToId: string, actorId: string, note?: string) => void;
  escalateTicket: (id: string, escalatedToId: string, reason: string, actorId: string) => void;
  replyTicket: (id: string, authorId: string, text: string) => void;

  /* people */
  addPerson: (input: Omit<Person, "id">) => Person;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;

  /* inventory — quantity is ALWAYS derived from the movement ledger */
  addInventoryItem: (input: Omit<InventoryItem, "id">) => InventoryItem;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  recordStockMovement: (
    itemId: string,
    kind: StockMovementKind,
    quantityDelta: number,
    reason: string | undefined,
    actorId: string,
  ) => void;

  /* purchasing */
  addPurchaseOrder: (input: Omit<PurchaseOrder, "id">) => PurchaseOrder;
  setPurchaseOrderStatus: (id: string, status: PurchaseOrderStatus, actorId: string) => void;

  /* finance */
  addTransaction: (input: Omit<Transaction, "id" | "status">) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  setTransactionStatus: (id: string, status: TransactionStatus) => void;
  deleteTransaction: (id: string) => void;


  /* work reports */
  addWorkReport: (input: Omit<WorkReport, "id">) => WorkReport;

  /* announcements */
  addAnnouncement: (input: NewAnnouncementInput) => Announcement;
  updateAnnouncement: (id: string, patch: Partial<Announcement>) => void;
  setAnnouncementStatus: (id: string, status: Announcement["status"], actorId: string) => void;
  deleteAnnouncement: (id: string) => void;

  /* suggestions */
  addSuggestion: (input: {
    userId: string;
    title: string;
    description: string;
    category: SuggestionCategory;
  }) => Suggestion;
  updateSuggestionStatus: (id: string, status: SuggestionStatus, response?: string) => void;

  /* messages */
  startOrGetConversation: (
    participantIds: string[],
    subject: string,
    propertyId?: string,
  ) => Conversation;
  /** Creates a group conversation. Creator becomes its first admin. */
  createGroupConversation: (input: {
    name: string;
    memberIds: string[];
    createdById: string;
    image?: string;
  }) => Conversation;
  /** Patches group metadata (name/image). Authorization is enforced in UI. */
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  addConversationMembers: (conversationId: string, memberIds: string[], actorId: string) => void;
  removeConversationMember: (conversationId: string, memberId: string) => void;
  leaveConversation: (conversationId: string, memberId: string) => void;
  sendMessage: (
    conversationId: string,
    senderId: string,
    text: string,
    attachmentFileIds?: string[],
  ) => void;
  /** Soft-deletes a message. Only the sender may delete their own message. */
  deleteMessage: (conversationId: string, messageId: string, actorId: string) => void;
  markConversationRead: (conversationId: string, personId: string) => void;

  /* documents */
  addDocument: (input: Omit<DocumentRecord, "id" | "createdAt" | "updatedAt">) => DocumentRecord;
  updateDocument: (id: string, patch: Partial<DocumentRecord>) => void;
  deleteDocument: (id: string) => void;

  /* files (metadata records — binary content lives behind storageKey) */
  addFileRecord: (
    input: Omit<FileRecord, "id" | "uploadedAt" | "updatedAt"> & { uploadedAt?: string },
  ) => FileRecord;
  updateFileRecord: (id: string, patch: Partial<FileRecord>) => void;
  deleteFileRecord: (id: string) => void;

  /* notifications */
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  /* wiki */
  addWikiArticle: (input: Omit<WikiArticle, "id">) => WikiArticle;
  updateWikiArticle: (id: string, patch: Partial<WikiArticle>) => void;
  deleteWikiArticle: (id: string) => void;

  /* system */
  resetDemoData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => fetchAll());

  const persist = useCallback(<K extends keyof AppData>(key: K, value: AppData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    persistCollection(key, value);
  }, []);

  const logActivity = useCallback(
    (event: { type: ActivityEvent["type"]; text: string; actorId?: string; color: ActivityColor; propertyId?: string; projectId?: string }) => {
      const entry: ActivityEvent = { id: nextId("act"), createdAt: nowIso(), ...event };
      const next = [entry, ...data.activity].slice(0, 200);
      persist("activity", next);
    },
    [data.activity, persist],
  );

  const pushNotifications = useCallback(
    (items: Array<Omit<AppNotification, "id" | "createdAt" | "read">>) => {
      const entries: AppNotification[] = items.map((n) => ({
        ...n,
        id: nextId("ntf"),
        createdAt: nowIso(),
        read: false,
      }));
      if (entries.length === 0) return;
      persist("notifications", [...entries, ...data.notifications]);
    },
    [data.notifications, persist],
  );

  /* ---------- lookups ---------- */

  const personById = useCallback((id: string) => data.people.find((p) => p.id === id), [data.people]);
  const propertyById = useCallback((id: string) => data.properties.find((p) => p.id === id), [data.properties]);
  const projectById = useCallback((id: string) => data.projects.find((p) => p.id === id), [data.projects]);

  const actorName = useCallback(
    (personId: string) => data.people.find((p) => p.id === personId)?.name ?? "Unknown",
    [data.people],
  );

  /* ---------- properties ---------- */

  const addProperty = useCallback(
    (input: Omit<Property, "id">) => {
      const property: Property = { ...input, id: nextId("prop") };
      persist("properties", [property, ...data.properties]);
      logActivity({
        type: "property",
        text: `Property added: ${property.name}`,
        color: "info",
      });
      return property;
    },
    [data.properties, persist, logActivity],
  );

  const updateProperty = useCallback(
    (id: string, patch: Partial<Property>) => {
      persist(
        "properties",
        data.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [data.properties, persist],
  );

  const deleteProperty = useCallback(
    (id: string) => {
      const target = data.properties.find((p) => p.id === id);
      persist("properties", data.properties.filter((p) => p.id !== id));
      if (target) {
        logActivity({ type: "property", text: `Property removed: ${target.name}`, color: "neutral" });
      }
    },
    [data.properties, persist, logActivity],
  );

  /* ---------- projects ---------- */

  const addProject = useCallback(
    (input: Omit<Project, "id">) => {
      const project: Project = { ...input, id: nextId("proj") };
      persist("projects", [project, ...data.projects]);
      logActivity({
        type: "project",
        text: `Project created: ${project.name}`,
        color: "info",
        propertyId: project.propertyId,
        projectId: project.id,
      });
      return project;
    },
    [data.projects, persist, logActivity],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      persist(
        "projects",
        data.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      if (typeof patch.progress === "number") {
        const project = data.projects.find((p) => p.id === id);
        if (project && patch.progress !== project.progress) {
          logActivity({
            type: "project",
            text: `${project.name} progress updated to ${patch.progress}%`,
            color: "info",
            projectId: id,
            propertyId: project.propertyId,
          });
          // Notify the client whose property this is.
          const property = data.properties.find((p) => p.id === project.propertyId);
          if (property?.ownerId) {
            pushNotifications([
              {
                recipientId: property.ownerId,
                type: "project-update",
                title: "Project progress updated",
                body: `${project.name} is now ${patch.progress}% complete.`,
                link: `/projects/${project.id}`,
              },
            ]);
          }
        }
      }
    },
    [data.projects, data.properties, persist, logActivity, pushNotifications],
  );

  const deleteProject = useCallback(
    (id: string) => {
      const target = data.projects.find((p) => p.id === id);
      persist("projects", data.projects.filter((p) => p.id !== id));
      persist("tasks", data.tasks.filter((t) => t.projectId !== id));
      if (target) {
        logActivity({ type: "project", text: `Project deleted: ${target.name}`, color: "neutral", projectId: id });
      }
    },
    [data.projects, data.tasks, persist, logActivity],
  );

  /* ---------- tasks ---------- */

  const addTask = useCallback(
    (input: NewTaskInput) => {
      const project = data.projects.find((p) => p.id === input.projectId);
      const task: Task = {
        id: nextId("task"),
        projectId: input.projectId,
        propertyId: project?.propertyId ?? "",
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        createdById: input.createdById,
        status: "not-started",
        priority: input.priority,
        dueDate: input.dueDate,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        progress: 0,
        comments: [],
        attachments: [],
        isTechnical: input.isTechnical,
      };
      persist("tasks", [task, ...data.tasks]);
      logActivity({
        type: "task",
        text: `Task created: ${task.title} (assigned to ${actorName(task.assigneeId)})`,
        actorId: input.createdById,
        color: "info",
        projectId: task.projectId,
        propertyId: task.propertyId,
      });
      pushNotifications([
        {
          recipientId: task.assigneeId,
          type: "task-assigned",
          title: task.isTechnical ? "New technical task assigned" : "New task assigned",
          body: `${task.title}${project ? ` — ${project.name}` : ""} (due ${task.dueDate}).`,
          link: "/tasks",
        },
      ]);
      return task;
    },
    [data.tasks, data.projects, persist, logActivity, pushNotifications, actorName],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>, actorId: string) => {
      const existing = data.tasks.find((t) => t.id === id);
      if (!existing) return;
      const updated: Task = { ...existing, ...patch, updatedAt: nowIso() };
      persist(
        "tasks",
        data.tasks.map((t) => (t.id === id ? updated : t)),
      );
      const project = data.projects.find((p) => p.id === existing.projectId);

      if (patch.assigneeId && patch.assigneeId !== existing.assigneeId) {
        pushNotifications([
          {
            recipientId: patch.assigneeId,
            type: "task-assigned",
            title: existing.isTechnical ? "Technical task assigned to you" : "Task assigned to you",
            body: `${updated.title}${project ? ` — ${project.name}` : ""} (due ${updated.dueDate}).`,
            link: "/tasks",
          },
        ]);
        logActivity({
          type: "task",
          text: `Task reassigned: ${updated.title} → ${actorName(patch.assigneeId)}`,
          actorId,
          color: "info",
          projectId: existing.projectId,
        });
      }

      if (patch.status && patch.status !== existing.status) {
        if (patch.status === "completed") {
          logActivity({
            type: "task",
            text: `Task completed: ${updated.title}`,
            actorId,
            color: "success",
            projectId: existing.projectId,
            propertyId: existing.propertyId,
          });
          const recipients = new Set<string>([existing.createdById]);
          if (project) recipients.add(project.builderId);
          recipients.delete(actorId);
          pushNotifications(
            [...recipients].map((recipientId) => ({
              recipientId,
              type: "task-completed" as NotificationType,
              title: "Task completed",
              body: `${actorName(actorId)} completed "${updated.title}".`,
              link: "/tasks",
            })),
          );
        } else if (patch.status === "blocked") {
          logActivity({
            type: "task",
            text: `Task blocked: ${updated.title}`,
            actorId,
            color: "danger",
            projectId: existing.projectId,
          });
          const recipients = new Set<string>([existing.createdById]);
          if (project) recipients.add(project.builderId);
          recipients.delete(actorId);
          pushNotifications(
            [...recipients].map((recipientId) => ({
              recipientId,
              type: "task-updated" as NotificationType,
              title: "Task blocked",
              body: `${actorName(actorId)} reported a blocker on "${updated.title}".`,
              link: "/tasks",
            })),
          );
        } else {
          logActivity({
            type: "task",
            text: `Task status changed (${existing.status} → ${patch.status}): ${updated.title}`,
            actorId,
            color: "warning",
            projectId: existing.projectId,
          });
        }
      }
    },
    [data.tasks, data.projects, persist, logActivity, pushNotifications, actorName],
  );

  const addTaskComment = useCallback(
    (taskId: string, authorId: string, text: string) => {
      const comment: TaskComment = { id: nextId("tc"), authorId, text, createdAt: nowIso() };
      persist(
        "tasks",
        data.tasks.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...t.comments, comment], updatedAt: nowIso() }
            : t,
        ),
      );
    },
    [data.tasks, persist],
  );

  const addTaskAttachment = useCallback(
    (taskId: string, attachment: Omit<TaskAttachment, "id">) => {
      const full: TaskAttachment = { ...attachment, id: nextId("ta") };
      persist(
        "tasks",
        data.tasks.map((t) =>
          t.id === taskId ? { ...t, attachments: [...t.attachments, full], updatedAt: nowIso() } : t,
        ),
      );
    },
    [data.tasks, persist],
  );

  const deleteTask = useCallback(
    (id: string) => {
      const target = data.tasks.find((t) => t.id === id);
      persist("tasks", data.tasks.filter((t) => t.id !== id));
      if (target) {
        logActivity({ type: "task", text: `Task deleted: ${target.title}`, color: "neutral", projectId: target.projectId });
      }
    },
    [data.tasks, persist, logActivity],
  );

  /* ---------- support tickets (requests / problems) ---------- */

  const addRequest = useCallback(
    (input: NewRequestInput) => {
      const maxTicket = data.requests.reduce((m, r) => Math.max(m, r.ticketNo ?? 1040), 1040);
      const request: ServiceRequest = {
        ...input,
        id: nextId("req"),
        ticketNo: maxTicket + 1,
        status: "submitted",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        updates: [],
      };
      persist("requests", [request, ...data.requests]);
      const property = data.properties.find((p) => p.id === request.propertyId);
      logActivity({
        type: "request",
        text: `${request.kind === "problem" ? "Problem reported" : "Request submitted"} #${request.ticketNo}: ${request.title}${
          property ? ` (${property.name})` : ""
        }`,
        actorId: request.submittedById,
        color: request.kind === "problem" ? "danger" : "info",
        propertyId: request.propertyId,
        projectId: request.projectId,
      });

      // Support workflow: Customer Service receives every new ticket first,
      // plus the Owner keeps full visibility.
      const csAgents = data.people.filter((p) => p.kind === "customer-service").map((p) => p.id);
      const recipients = new Set<string>(["p-adm", ...csAgents]);
      recipients.delete(request.submittedById);
      pushNotifications(
        [...recipients].map((recipientId) => ({
          recipientId,
          type: (request.kind === "problem" ? "issue-reported" : "request-new") as NotificationType,
          title: request.kind === "problem" ? "New support ticket" : "New support ticket",
          body: `#${request.ticketNo} ${request.title}${property ? ` — ${property.name}` : ""}.`,
          link: "/support",
        })),
      );
      return request;
    },
    [data.requests, data.properties, data.people, persist, logActivity, pushNotifications],
  );

  const updateRequestStatus = useCallback(
    (
      id: string,
      status: ServiceRequest["status"],
      actorId: string,
      note?: string,
      assignedToId?: string,
    ) => {
      const existing = data.requests.find((r) => r.id === id);
      if (!existing) return;
      const update = {
        id: nextId("ru"),
        authorId: actorId,
        text: note || `Status changed to ${status.replace("-", " ")}.`,
        status,
        createdAt: nowIso(),
      };
      const updated: ServiceRequest = {
        ...existing,
        status,
        updatedAt: nowIso(),
        assignedToId: assignedToId ?? existing.assignedToId,
        updates: [...existing.updates, update],
      };
      persist(
        "requests",
        data.requests.map((r) => (r.id === id ? updated : r)),
      );
      logActivity({
        type: "request",
        text: `Ticket #${existing.ticketNo} "${existing.title}" → ${status.replace("-", " ")}`,
        actorId,
        color: status === "resolved" || status === "closed" ? "success" : "info",
        propertyId: existing.propertyId,
        projectId: existing.projectId,
      });

      const recipients = new Set<string>([existing.submittedById]);
      if (assignedToId) recipients.add(assignedToId);
      recipients.delete(actorId);
      pushNotifications(
        [...recipients].map((recipientId) => ({
          recipientId,
          type: (status === "resolved" ? "issue-resolved" : "request-update") as NotificationType,
          title:
            status === "resolved"
              ? "Issue resolved"
              : status === "assigned"
                ? "Ticket assigned"
                : "Ticket updated",
          body: `#${existing.ticketNo} "${existing.title}" is now ${status.replace("-", " ")}.${note ? ` Note: ${note}` : ""}`,
          link: existing.kind === "problem" ? "/problems" : "/requests",
        })),
      );
    },
    [data.requests, persist, logActivity, pushNotifications],
  );

  /** CS/owner assigns a ticket to a handler (agent, builder, or developer). */
  const assignTicket = useCallback(
    (id: string, assignedToId: string, actorId: string, note?: string) => {
      const existing = data.requests.find((r) => r.id === id);
      if (!existing || !assignedToId) return;
      const update = {
        id: nextId("ru"),
        authorId: actorId,
        text: note?.trim() || `Assigned to ${actorName(assignedToId)}.`,
        status: "assigned" as ServiceRequest["status"],
        createdAt: nowIso(),
      };
      const updated: ServiceRequest = {
        ...existing,
        status: "assigned",
        assignedToId,
        updatedAt: nowIso(),
        updates: [...existing.updates, update],
      };
      persist(
        "requests",
        data.requests.map((r) => (r.id === id ? updated : r)),
      );
      logActivity({
        type: "request",
        text: `Ticket #${existing.ticketNo} assigned to ${actorName(assignedToId)} by ${actorName(actorId)}`,
        actorId,
        color: "info",
        propertyId: existing.propertyId,
      });
      pushNotifications([
        {
          recipientId: assignedToId,
          type: "ticket-assigned",
          title: "Ticket assigned to you",
          body: `#${existing.ticketNo} "${existing.title}"${note ? ` — ${note.trim()}` : ""}`,
          link: "/my-tickets",
        },
        {
          recipientId: existing.submittedById,
          type: "request-update",
          title: "Your ticket was assigned",
          body: `#${existing.ticketNo} "${existing.title}" is being handled by ${actorName(assignedToId)}.`,
          link: existing.kind === "problem" ? "/problems" : "/requests",
        },
      ]);
    },
    [data.requests, persist, logActivity, pushNotifications, actorName],
  );

  /** Escalate a ticket to a developer (technical) or the owner (management). */
  const escalateTicket = useCallback(
    (id: string, escalatedToId: string, reason: string, actorId: string) => {
      const existing = data.requests.find((r) => r.id === id);
      if (!existing || !escalatedToId || !reason.trim()) return;
      const update = {
        id: nextId("ru"),
        authorId: actorId,
        text: `Escalated to ${actorName(escalatedToId)}: ${reason.trim()}`,
        createdAt: nowIso(),
      };
      const updated: ServiceRequest = {
        ...existing,
        escalatedToId,
        escalationReason: reason.trim(),
        escalatedAt: nowIso(),
        updatedAt: nowIso(),
        updates: [...existing.updates, update],
      };
      persist(
        "requests",
        data.requests.map((r) => (r.id === id ? updated : r)),
      );
      logActivity({
        type: "request",
        text: `Ticket #${existing.ticketNo} escalated to ${actorName(escalatedToId)} — ${reason.trim()}`,
        actorId,
        color: "warning",
        propertyId: existing.propertyId,
      });
      pushNotifications([
        {
          recipientId: escalatedToId,
          type: "ticket-escalated",
          title: "Ticket escalated to you",
          body: `#${existing.ticketNo} "${existing.title}" — ${reason.trim()}`,
          link: "/my-tickets",
        },
        {
          recipientId: existing.submittedById,
          type: "request-update",
          title: "Your ticket is being escalated",
          body: `#${existing.ticketNo} "${existing.title}" has been escalated for specialized handling.`,
          link: existing.kind === "problem" ? "/problems" : "/requests",
        },
      ]);
    },
    [data.requests, persist, logActivity, pushNotifications, actorName],
  );

  /** Reply thread entry that does not change status. */
  const replyTicket = useCallback(
    (id: string, authorId: string, text: string) => {
      const existing = data.requests.find((r) => r.id === id);
      if (!existing || !text.trim()) return;
      const update = {
        id: nextId("ru"),
        authorId,
        text: text.trim(),
        createdAt: nowIso(),
      };
      persist(
        "requests",
        data.requests.map((r) =>
          r.id === id ? { ...r, updatedAt: nowIso(), updates: [...r.updates, update] } : r,
        ),
      );
      // Notify the other side of the conversation.
      const recipients = new Set<string>([existing.submittedById]);
      if (existing.assignedToId) recipients.add(existing.assignedToId);
      if (existing.escalatedToId) recipients.add(existing.escalatedToId);
      recipients.delete(authorId);
      pushNotifications(
        [...recipients].map((recipientId) => ({
          recipientId,
          type: "request-update" as NotificationType,
          title: `Reply on ticket #${existing.ticketNo}`,
          body: `${actorName(authorId)}: ${text.trim().slice(0, 90)}`,
          link: "/my-tickets",
        })),
      );
    },
    [data.requests, persist, pushNotifications, actorName],
  );

  /* ---------- people ---------- */

  const addPerson = useCallback(
    (input: Omit<Person, "id">) => {
      const person: Person = { ...input, id: nextId("per") };
      persist("people", [...data.people, person]);
      logActivity({ type: "people", text: `${person.kind} added: ${person.name}`, color: "info" });
      return person;
    },
    [data.people, persist, logActivity],
  );

  const updatePerson = useCallback(
    (id: string, patch: Partial<Person>) => {
      persist(
        "people",
        data.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [data.people, persist],
  );

  const deletePerson = useCallback(
    (id: string) => {
      const target = data.people.find((p) => p.id === id);
      persist("people", data.people.filter((p) => p.id !== id));
      if (target) {
        logActivity({ type: "people", text: `${target.kind} removed: ${target.name}`, color: "neutral" });
      }
    },
    [data.people, persist, logActivity],
  );

  /* ---------- inventory (movement ledger) ---------- */

  const addInventoryItem = useCallback(
    (input: Omit<InventoryItem, "id">) => {
      const item: InventoryItem = { ...input, id: nextId("inv") };
      persist("inventory", [item, ...data.inventory]);
      logActivity({ type: "inventory", text: `Inventory item added: ${item.name}`, color: "info" });
      return item;
    },
    [data.inventory, persist, logActivity],
  );

  const updateInventoryItem = useCallback(
    (id: string, patch: Partial<InventoryItem>) => {
      persist(
        "inventory",
        data.inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
    },
    [data.inventory, persist],
  );

  const deleteInventoryItem = useCallback(
    (id: string) => {
      const target = data.inventory.find((i) => i.id === id);
      persist("inventory", data.inventory.filter((i) => i.id !== id));
      persist("inventoryTransactions", data.inventoryTransactions.filter((t) => t.itemId !== id));
      if (target) {
        logActivity({ type: "inventory", text: `Inventory item removed: ${target.name}`, color: "neutral" });
      }
    },
    [data.inventory, data.inventoryTransactions, persist, logActivity],
  );

  /**
   * Records a stock movement. Current quantity is re-derived from the
   * ledger; when an item crosses below its minimum stock the Owner is
   * notified once per crossing.
   */
  const recordStockMovement = useCallback(
    (itemId: string, kind: StockMovementKind, quantityDelta: number, reason: string | undefined, actorId: string) => {
      const item = data.inventory.find((i) => i.id === itemId);
      if (!item || !Number.isFinite(quantityDelta) || quantityDelta === 0) return;

      const before = itemStockStatus(item, data.inventoryTransactions);
      const afterLevel = computeStockLevel(item, [
        ...data.inventoryTransactions,
        { id: "preview", itemId, kind, quantityDelta, date: nowIso() },
      ]);
      const afterQty = Math.max(0, afterLevel.current);

      const movement: InventoryTransaction = {
        id: nextId("ivt"),
        itemId,
        kind,
        quantityDelta,
        reason: reason?.trim() || undefined,
        actorId,
        date: nowIso().slice(0, 10),
      };
      persist("inventoryTransactions", [movement, ...data.inventoryTransactions]);

      logActivity({
        type: "inventory",
        text: `${item.name}: ${before.level.current} → ${afterQty} ${item.unit} (${kind.replace("-", " ")}${
          reason?.trim() ? ` — ${reason.trim()}` : ""
        })`,
        actorId,
        color: kind === "stock-in" || kind === "transfer-in" ? "success" : "neutral",
      });

      // Low-stock detection: crossed from OK to LOW/OUT after this movement.
      const wasOk = before.status === "in-stock";
      const isLowNow = afterQty > 0 ? afterQty <= item.minStock : true;
      if (wasOk && isLowNow) {
        logActivity({
          type: "inventory",
          text: `${item.name} fell below minimum stock (${afterQty}/${item.minStock} ${item.unit})`,
          color: "warning",
        });
        pushNotifications([
          {
            recipientId: "p-adm",
            type: "low-stock",
            title: afterQty <= 0 ? "Out of stock alert" : "Low stock alert",
            body: `${item.name} is at ${afterQty} ${item.unit} (minimum ${item.minStock}). Consider a purchase order.`,
            link: "/inventory",
          },
        ]);
      }
    },
    [data.inventory, data.inventoryTransactions, persist, logActivity, pushNotifications],
  );

  /* ---------- purchasing ---------- */

  const addPurchaseOrder = useCallback(
    (input: Omit<PurchaseOrder, "id">) => {
      const order: PurchaseOrder = { ...input, id: nextId("po") };
      persist("purchaseOrders", [order, ...data.purchaseOrders]);
      logActivity({
        type: "purchase",
        text: `Purchase request submitted: ${order.supplier} (${order.items.length} item${order.items.length > 1 ? "s" : ""})`,
        actorId: order.requestedById,
        color: "info",
        projectId: order.projectId,
      });
      pushNotifications([
        {
          recipientId: "p-adm",
          type: "purchase-submitted",
          title: "Purchase request pending approval",
          body: `${order.supplier} — submitted by ${actorName(order.requestedById)}.`,
          link: "/purchasing",
        },
      ]);
      return order;
    },
    [data.purchaseOrders, persist, logActivity, pushNotifications, actorName],
  );

  /**
   * Purchase workflow:
   * pending (requested) → approved → purchased → delivered (received)
   * Any of pending/approved/purchased may be cancelled.
   * Delivery automatically adds stock (movement ledger) AND records the
   * matching expense in finance — exactly once per order.
   */
  const setPurchaseOrderStatus = useCallback(
    (id: string, status: PurchaseOrderStatus, actorId: string) => {
      const order = data.purchaseOrders.find((o) => o.id === id);
      if (!order || order.status === status) return;

      let inventoryNext = data.inventoryTransactions;
      let transactionsNext = data.transactions;
      let poPatch: Partial<PurchaseOrder> = { status };

      if (status === "delivered") {
        // 1) Stock in for each linked inventory line (once).
        const movements: InventoryTransaction[] = order.items
          .filter((line) => line.inventoryItemId)
          .map((line) => ({
            id: nextId("ivt"),
            itemId: line.inventoryItemId!,
            kind: "stock-in" as StockMovementKind,
            quantityDelta: line.quantity,
            reason: `${order.id.toUpperCase()} received from ${order.supplier}`,
            actorId,
            date: nowIso().slice(0, 10),
            purchaseOrderId: order.id,
          }));
        inventoryNext = [...movements, ...data.inventoryTransactions];

        // 2) Record the expense (once — guard against double delivery).
        const alreadyRecorded =
          order.receivedTxId != null ||
          data.transactions.some((t) => t.purchaseOrderId === order.id);
        if (!alreadyRecorded) {
          const tx: Transaction = {
            id: nextId("tx"),
            date: nowIso().slice(0, 10),
            description: `${order.supplier} — ${order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}`,
            category: "Materials",
            amount: order.total,
            type: "expense",
            propertyId: order.projectId
              ? data.projects.find((p) => p.id === order.projectId)?.propertyId
              : undefined,
            projectId: order.projectId,
            status: "active",
            purchaseOrderId: order.id,
          };
          transactionsNext = [tx, ...data.transactions];
          poPatch.receivedTxId = tx.id;
        }

        logActivity({
          type: "purchase",
          text: `Delivery received: ${order.supplier} — stock added & expense recorded (${order.total.toLocaleString()} ₱)`,
          actorId,
          color: "success",
          projectId: order.projectId,
        });
        pushNotifications([
          {
            recipientId: order.requestedById,
            type: "purchase-received",
            title: "Purchase delivered",
            body: `${order.supplier} — items added to inventory and expense recorded.`,
            link: "/purchasing",
          },
        ]);
      } else {
        logActivity({
          type: "purchase",
          text: `Purchase order ${order.supplier} ${status}`,
          actorId,
          color: status === "approved" ? "success" : status === "rejected" || status === "cancelled" ? "danger" : "info",
          projectId: order.projectId,
        });

        if (status === "approved" || status === "rejected") {
          pushNotifications([
            {
              recipientId: order.requestedById,
              type: (status === "approved" ? "purchase-approved" : "purchase-rejected") as NotificationType,
              title: `Purchase order ${status}`,
              body: `${order.supplier} — reviewed by ${actorName(actorId)}.`,
              link: "/purchasing",
            },
          ]);
        }
      }

      persist("inventoryTransactions", inventoryNext);
      persist("transactions", transactionsNext);
      persist(
        "purchaseOrders",
        data.purchaseOrders.map((o) => (o.id === id ? { ...o, ...poPatch } : o)),
      );
    },
    [data.purchaseOrders, data.inventoryTransactions, data.transactions, data.projects, persist, logActivity, pushNotifications, actorName],
  );

  /* ---------- finance ---------- */

  const addTransaction = useCallback(
    (input: Omit<Transaction, "id" | "status">) => {
      const tx: Transaction = { ...input, id: nextId("tx"), status: "active" };
      persist("transactions", [tx, ...data.transactions]);
      logActivity({
        type: "finance",
        text: `${tx.type === "income" ? "Income" : "Expense"} recorded: ${tx.description}`,
        color: tx.type === "income" ? "success" : "warning",
        propertyId: tx.propertyId,
        projectId: tx.projectId,
      });
      return tx;
    },
    [data.transactions, persist, logActivity],
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) => {
      persist(
        "transactions",
        data.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    [data.transactions, persist],
  );

  /** Cancelled transactions stay visible for audit but leave all totals. */
  const setTransactionStatus = useCallback(
    (id: string, status: TransactionStatus) => {
      const tx = data.transactions.find((t) => t.id === id);
      persist(
        "transactions",
        data.transactions.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      if (tx) {
        logActivity({
          type: "finance",
          text: `Transaction ${status === "cancelled" ? "cancelled" : "restored"}: ${tx.description}`,
          color: status === "cancelled" ? "neutral" : "success",
          propertyId: tx.propertyId,
          projectId: tx.projectId,
        });
      }
    },
    [data.transactions, persist, logActivity],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      persist("transactions", data.transactions.filter((t) => t.id !== id));
    },
    [data.transactions, persist],
  );


  /* ---------- work reports ---------- */

  const addWorkReport = useCallback(
    (input: Omit<WorkReport, "id">) => {
      const report: WorkReport = { ...input, id: nextId("wr") };
      persist("workReports", [report, ...data.workReports]);
      logActivity({
        type: "task",
        text: `Field report submitted: ${report.title}`,
        actorId: report.authorId,
        color: "info",
        projectId: report.projectId,
      });
      const project = data.projects.find((p) => p.id === report.projectId);
      if (project) {
        pushNotifications([
          {
            recipientId: project.builderId,
            type: "task-updated",
            title: "New field report",
            body: `${actorName(report.authorId)}: ${report.title}`,
            link: "/reports",
          },
        ]);
      }
      return report;
    },
    [data.workReports, data.projects, persist, logActivity, pushNotifications, actorName],
  );

  /* ---------- announcements ---------- */

  const addAnnouncement = useCallback(
    (input: NewAnnouncementInput) => {
      const announcement: Announcement = {
        ...input,
        id: nextId("ann"),
        status: "draft",
        createdAt: nowIso(),
      };
      persist("announcements", [announcement, ...data.announcements]);
      return announcement;
    },
    [data.announcements, persist],
  );

  const updateAnnouncement = useCallback(
    (id: string, patch: Partial<Announcement>) => {
      persist(
        "announcements",
        data.announcements.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [data.announcements, persist],
  );

  /** Publish/unpublish/archive. Publishing notifies the audience once. */
  const setAnnouncementStatus = useCallback(
    (id: string, status: Announcement["status"], actorId: string) => {
      const announcement = data.announcements.find((a) => a.id === id);
      if (!announcement) return;
      const isFirstPublish = status === "published" && announcement.status !== "published";

      persist(
        "announcements",
        data.announcements.map((a) =>
          a.id === id
            ? { ...a, status, publishedAt: isFirstPublish ? nowIso() : a.publishedAt }
            : a,
        ),
      );

      if (isFirstPublish) {
        logActivity({
          type: "announcement",
          text: `Announcement published: ${announcement.title}`,
          actorId,
          color: "info",
        });
        const audienceKinds: Record<AnnouncementAudience, Person["kind"][]> = {
          EVERYONE: ["builder", "developer", "worker", "customer-service"],
          DEVELOPERS: ["developer"],
          WORKERS: ["worker"],
          CUSTOMER_SERVICE: ["customer-service"],
        };
        const kinds = audienceKinds[announcement.audience];
        const recipients = data.people
          .filter((p) => kinds.includes(p.kind))
          .map((p) => p.id)
          .filter((pid) => pid !== announcement.authorId);
        pushNotifications(
          recipients.map((recipientId) => ({
            recipientId,
            type: "announcement" as NotificationType,
            title: "New announcement",
            body: announcement.title,
            link: "/announcements",
          })),
        );
      } else {
        logActivity({
          type: "announcement",
          text: `Announcement ${status}: ${announcement.title}`,
          actorId,
          color: "neutral",
        });
      }
    },
    [data.announcements, data.people, persist, logActivity, pushNotifications],
  );

  const deleteAnnouncement = useCallback(
    (id: string) => {
      persist("announcements", data.announcements.filter((a) => a.id !== id));
    },
    [data.announcements, persist],
  );

  /* ---------- suggestions ---------- */

  const addSuggestion = useCallback(
    (input: { userId: string; title: string; description: string; category: SuggestionCategory }) => {
      const suggestion: Suggestion = {
        ...input,
        id: nextId("sug"),
        status: "new",
        createdAt: nowIso(),
      };
      persist("suggestions", [suggestion, ...data.suggestions]);
      logActivity({
        type: "suggestion",
        text: `Suggestion submitted: ${suggestion.title}`,
        actorId: suggestion.userId,
        color: "info",
      });
      return suggestion;
    },
    [data.suggestions, persist, logActivity],
  );

  const updateSuggestionStatus = useCallback(
    (id: string, status: SuggestionStatus, response?: string) => {
      const suggestion = data.suggestions.find((s) => s.id === id);
      persist(
        "suggestions",
        data.suggestions.map((s) =>
          s.id === id ? { ...s, status, response: response?.trim() || s.response } : s,
        ),
      );
      if (suggestion) {
        logActivity({
          type: "suggestion",
          text: `Suggestion "${suggestion.title}" marked ${status}`,
          color: status === "completed" ? "success" : "info",
        });
        pushNotifications([
          {
            recipientId: suggestion.userId,
            type: "suggestion-update",
            title: "Your suggestion was reviewed",
            body: `"${suggestion.title}" is now ${status}.${response?.trim() ? ` Note: ${response.trim()}` : ""}`,
            link: "/suggestions",
          },
        ]);
      }
    },
    [data.suggestions, persist, logActivity, pushNotifications],
  );

  /* ---------- messages ---------- */

  const startOrGetConversation = useCallback(
    (participantIds: string[], subject: string, propertyId?: string) => {
      const key = [...participantIds].sort().join("|");
      const existing = data.conversations.find(
        (c) =>
          [...c.participantIds].sort().join("|") === key &&
          c.subject === subject &&
          c.propertyId === propertyId,
      );
      if (existing) return existing;
      const conversation: Conversation = {
        id: nextId("conv"),
        kind: "direct",
        participantIds,
        subject,
        propertyId,
        messages: [],
        updatedAt: nowIso(),
      };
      persist("conversations", [conversation, ...data.conversations]);
      return conversation;
    },
    [data.conversations, persist],
  );

  const createGroupConversation = useCallback(
    (input: { name: string; memberIds: string[]; createdById: string; image?: string }) => {
      const name = input.name.trim() || "New group";
      const participants = Array.from(new Set([input.createdById, ...input.memberIds]));
      const conversation: Conversation = {
        id: nextId("conv"),
        kind: "group",
        participantIds: participants,
        subject: name,
        messages: [],
        updatedAt: nowIso(),
        createdById: input.createdById,
        createdAt: nowIso(),
        adminIds: [input.createdById],
        image: input.image,
      };
      persist("conversations", [conversation, ...data.conversations]);
      pushNotifications(
        participants
          .filter((pid) => pid !== input.createdById)
          .map((recipientId) => ({
            recipientId,
            type: "message" as NotificationType,
            title: `Added to group: ${name}`,
            body: `${actorName(input.createdById)} added you to "${name}".`,
            link: "/messages",
          })),
      );
      return conversation;
    },
    [data.conversations, persist, pushNotifications, actorName],
  );

  const updateConversation = useCallback(
    (id: string, patch: Partial<Conversation>) => {
      persist(
        "conversations",
        data.conversations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [data.conversations, persist],
  );

  const addConversationMembers = useCallback(
    (conversationId: string, memberIds: string[], actorId: string) => {
      const conversation = data.conversations.find((c) => c.id === conversationId);
      if (!conversation || memberIds.length === 0) return;
      const additions = memberIds.filter((id) => !conversation.participantIds.includes(id));
      if (additions.length === 0) return;
      persist(
        "conversations",
        data.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, participantIds: [...c.participantIds, ...additions], updatedAt: nowIso() }
            : c,
        ),
      );
      pushNotifications(
        additions.map((recipientId) => ({
          recipientId,
          type: "message" as NotificationType,
          title: `Added to group: ${conversation.subject}`,
          body: `${actorName(actorId)} added you to "${conversation.subject}".`,
          link: "/messages",
        })),
      );
    },
    [data.conversations, persist, pushNotifications, actorName],
  );

  const removeConversationMember = useCallback(
    (conversationId: string, memberId: string) => {
      const conversation = data.conversations.find((c) => c.id === conversationId);
      if (!conversation || !conversation.participantIds.includes(memberId)) return;
      persist(
        "conversations",
        data.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                participantIds: c.participantIds.filter((pid) => pid !== memberId),
                adminIds: c.adminIds?.filter((aid) => aid !== memberId),
              }
            : c,
        ),
      );
      pushNotifications([
        {
          recipientId: memberId,
          type: "message",
          title: `Removed from group: ${conversation.subject}`,
          body: `You were removed from "${conversation.subject}" by ${actorName(conversation.createdById ?? "")}.`,
          link: "/messages",
        },
      ]);
    },
    [data.conversations, persist, pushNotifications, actorName],
  );

  const leaveConversation = useCallback(
    (conversationId: string, memberId: string) => {
      const conversation = data.conversations.find((c) => c.id === conversationId);
      if (!conversation || !conversation.participantIds.includes(memberId)) return;
      persist(
        "conversations",
        data.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                participantIds: c.participantIds.filter((pid) => pid !== memberId),
                adminIds: c.adminIds?.filter((aid) => aid !== memberId),
              }
            : c,
        ),
      );
    },
    [data.conversations, persist],
  );

  const sendMessage = useCallback(
    (conversationId: string, senderId: string, text: string, attachmentFileIds?: string[]) => {
      const conversation = data.conversations.find((c) => c.id === conversationId);
      if (!conversation) return;
      const attachments = (attachmentFileIds ?? []).map((fileId) => ({ fileId }));
      const message = {
        id: nextId("msg"),
        senderId,
        text,
        timestamp: nowIso(),
        readBy: [] as string[],
        ...(attachments.length > 0 ? { attachments } : {}),
      };
      persist(
        "conversations",
        data.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message], updatedAt: message.timestamp }
            : c,
        ),
      );
      const sender = actorName(senderId);
      const preview =
        text.trim().length > 0
          ? text.slice(0, 80)
          : attachments.length > 0
            ? `📎 ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}`
            : "";
      pushNotifications(
        conversation.participantIds
          .filter((pid) => pid !== senderId)
          .map((recipientId) => ({
            recipientId,
            type: "message" as NotificationType,
            title: `New message from ${sender}`,
            body: preview,
            link: "/messages",
          })),
      );
    },
    [data.conversations, persist, pushNotifications, actorName],
  );

  /**
   * Soft-delete a chat message. Authorization lives here (service layer),
   * not in the UI: only the sender can delete their own message. Content
   * is scrubbed so nothing sensitive remains behind the tombstone.
   */
  const deleteMessage = useCallback(
    (conversationId: string, messageId: string, actorId: string) => {
      const conversation = data.conversations.find((c) => c.id === conversationId);
      const message = conversation?.messages.find((m) => m.id === messageId);
      if (!conversation || !message || message.senderId !== actorId || message.deleted) return;
      persist(
        "conversations",
        data.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, deleted: true, text: "", attachments: undefined }
                    : m,
                ),
              }
            : c,
        ),
      );
    },
    [data.conversations, persist],
  );

  /* ---------- documents ---------- */

  const addDocument = useCallback(
    (input: Omit<DocumentRecord, "id" | "createdAt" | "updatedAt">) => {
      const now = nowIso();
      const document: DocumentRecord = { ...input, id: nextId("doc"), createdAt: now, updatedAt: now };
      persist("documents", [document, ...data.documents]);
      return document;
    },
    [data.documents, persist],
  );

  const updateDocument = useCallback(
    (id: string, patch: Partial<DocumentRecord>) => {
      persist(
        "documents",
        data.documents.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d)),
      );
    },
    [data.documents, persist],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      persist("documents", data.documents.filter((d) => d.id !== id));
    },
    [data.documents, persist],
  );

  /* ---------- files ---------- */

  const addFileRecord = useCallback(
    (input: Omit<FileRecord, "id" | "uploadedAt" | "updatedAt"> & { uploadedAt?: string }) => {
      const now = input.uploadedAt ?? nowIso();
      const file: FileRecord = { ...input, id: nextId("file"), uploadedAt: now, updatedAt: now };
      persist("files", [file, ...data.files]);
      return file;
    },
    [data.files, persist],
  );

  const updateFileRecord = useCallback(
    (id: string, patch: Partial<FileRecord>) => {
      persist(
        "files",
        data.files.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: nowIso() } : f)),
      );
    },
    [data.files, persist],
  );

  const deleteFileRecord = useCallback(
    (id: string) => {
      persist("files", data.files.filter((f) => f.id !== id));
    },
    [data.files, persist],
  );

  const markConversationRead = useCallback(
    (conversationId: string, personId: string) => {
      persist(
        "conversations",
        data.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.readBy.includes(personId) ? m : { ...m, readBy: [...m.readBy, personId] },
                ),
              }
            : c,
        ),
      );
    },
    [data.conversations, persist],
  );

  /* ---------- notifications ---------- */

  const markNotificationRead = useCallback(
    (id: string) => {
      persist(
        "notifications",
        data.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    [data.notifications, persist],
  );

  const markAllNotificationsRead = useCallback(() => {
    persist(
      "notifications",
      data.notifications.map((n) => ({ ...n, read: true })),
    );
  }, [data.notifications, persist]);

  /* ---------- wiki ---------- */

  const addWikiArticle = useCallback(
    (input: Omit<WikiArticle, "id">) => {
      const article: WikiArticle = { ...input, id: nextId("wa") };
      persist("wikiArticles", [article, ...data.wikiArticles]);
      logActivity({ type: "wiki", text: `Wiki article published: ${article.title}`, actorId: article.authorId, color: "info" });
      return article;
    },
    [data.wikiArticles, persist, logActivity],
  );

  const updateWikiArticle = useCallback(
    (id: string, patch: Partial<WikiArticle>) => {
      persist(
        "wikiArticles",
        data.wikiArticles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [data.wikiArticles, persist],
  );

  const deleteWikiArticle = useCallback(
    (id: string) => {
      persist("wikiArticles", data.wikiArticles.filter((a) => a.id !== id));
    },
    [data.wikiArticles, persist],
  );

  /* ---------- system ---------- */

  const resetDemoData = useCallback(() => {
    const fresh = resetDatabase();
    setData(fresh);
  }, []);

  const value = useMemo<DataContextType>(
    () => ({
      ...data,
      personById,
      propertyById,
      projectById,
      actorName,
      addProperty,
      updateProperty,
      deleteProperty,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      addTaskComment,
      addTaskAttachment,
      deleteTask,
      addRequest,
      updateRequestStatus,
      assignTicket,
      escalateTicket,
      replyTicket,
      addPerson,
      updatePerson,
      deletePerson,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
      recordStockMovement,
      addPurchaseOrder,
      setPurchaseOrderStatus,
      addTransaction,
      updateTransaction,
      setTransactionStatus,
      deleteTransaction,
      addWorkReport,
      addAnnouncement,
      updateAnnouncement,
      setAnnouncementStatus,
      deleteAnnouncement,
      addSuggestion,
      updateSuggestionStatus,
      startOrGetConversation,
      createGroupConversation,
      updateConversation,
      addConversationMembers,
      removeConversationMember,
      leaveConversation,
      sendMessage,
      deleteMessage,
      markConversationRead,
      addDocument,
      updateDocument,
      deleteDocument,
      addFileRecord,
      updateFileRecord,
      deleteFileRecord,
      markNotificationRead,
      markAllNotificationsRead,
      addWikiArticle,
      updateWikiArticle,
      deleteWikiArticle,
      resetDemoData,
    }),
    [
      data,
      personById,
      propertyById,
      projectById,
      actorName,
      addProperty,
      updateProperty,
      deleteProperty,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      addTaskComment,
      addTaskAttachment,
      deleteTask,
      addRequest,
      updateRequestStatus,
      assignTicket,
      escalateTicket,
      replyTicket,
      addPerson,
      updatePerson,
      deletePerson,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
      recordStockMovement,
      addPurchaseOrder,
      setPurchaseOrderStatus,
      addTransaction,
      updateTransaction,
      setTransactionStatus,
      deleteTransaction,
      addWorkReport,
      addAnnouncement,
      updateAnnouncement,
      setAnnouncementStatus,
      deleteAnnouncement,
      addSuggestion,
      updateSuggestionStatus,
      startOrGetConversation,
      createGroupConversation,
      updateConversation,
      addConversationMembers,
      removeConversationMember,
      leaveConversation,
      sendMessage,
      deleteMessage,
      markConversationRead,
      addDocument,
      updateDocument,
      deleteDocument,
      addFileRecord,
      updateFileRecord,
      deleteFileRecord,
      markNotificationRead,
      markAllNotificationsRead,
      addWikiArticle,
      updateWikiArticle,
      deleteWikiArticle,
      resetDemoData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

/** Convenience hook: current user's person record (or null). */
export function useCurrentUserPerson(user: User | null): Person | undefined {
  const { people } = useData();
  return user ? people.find((p) => p.id === user.personId) : undefined;
}