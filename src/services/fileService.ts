/* ============================================================
   FamilyBuild — File Service
   ------------------------------------------------------------
   Centralized file logic shared by Documents, Files, Messages,
   and support workflows. UI components never interpret file
   metadata themselves.

   Layers:
     UI  →  fileService (this module)  →  FileRecord metadata
         →  mock storage (`storageKey`) → future real storage

   Access control mirrors the authorization model in
   data/permissions.ts: a file's visibility follows its parent
   object (project / task / conversation / document), so files
   are never globally visible by default.
   ============================================================ */

import type {
  Conversation,
  FileKind,
  FileRecord,
  Person,
  Project,
  Task,
  UserRole,
} from "../data/types";

/** Largest inline preview payload kept for a demo image upload. */
export const MAX_INLINE_IMAGE_BYTES = 400_000;
/** Hard cap for any single demo upload (localStorage is small). */
export const MAX_UPLOAD_BYTES = 2_000_000;

/* ---------- Kind detection ---------- */

const EXT_KINDS: Array<[string, FileKind]> = [
  [".png", "image"],
  [".jpg", "image"],
  [".jpeg", "image"],
  [".gif", "image"],
  [".webp", "image"],
  [".svg", "image"],
  [".pdf", "pdf"],
  [".xls", "spreadsheet"],
  [".xlsx", "spreadsheet"],
  [".csv", "spreadsheet"],
  [".doc", "document"],
  [".docx", "document"],
  [".txt", "document"],
  [".md", "document"],
  [".zip", "archive"],
  [".rar", "archive"],
  [".7z", "archive"],
];

export function detectFileKind(fileName: string, mimeType?: string): FileKind {
  const lower = fileName.toLowerCase();
  for (const [ext, kind] of EXT_KINDS) {
    if (lower.endsWith(ext)) return kind;
  }
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "other";
}

/* ---------- Presentation helpers ---------- */

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileEmoji(kind: FileKind): string {
  switch (kind) {
    case "image":
      return "🖼️";
    case "pdf":
      return "📕";
    case "spreadsheet":
      return "📊";
    case "document":
      return "📄";
    case "archive":
      return "🗜️";
    default:
      return "📎";
  }
}

export function visibilityLabel(visibility: FileRecord["visibility"]): string {
  switch (visibility) {
    case "private":
      return "Private";
    case "project":
      return "Project";
    case "task":
      return "Task";
    case "conversation":
      return "Conversation";
    case "organization":
      return "Organization";
    default:
      return visibility;
  }
}

/* ---------- Authorization ----------
   A viewer may access a file when:
   - they uploaded it, OR
   - the file is organization-wide, OR
   - the parent object includes them as an authorized member, OR
   - they hold an oversight role (Owner/Manager) for non-conversation
     scopes. Conversation files stay STRICTLY within participants —
     even Owner/Manager cannot read private chats they are not part of. */

export interface FileAccessContext {
  people: Person[];
  projects: Project[];
  tasks: Task[];
  conversations: Conversation[];
}

export function canAccessFile(
  file: FileRecord,
  viewer: { personId: string; role: UserRole },
  ctx: FileAccessContext,
): boolean {
  if (file.uploadedById === viewer.personId) return true;
  if (file.visibility === "organization") return true;

  const oversight = viewer.role === "owner" || viewer.role === "manager";

  switch (file.visibility) {
    case "private":
      return viewer.role === "owner";

    case "conversation": {
      const conv = ctx.conversations.find((c) => c.id === file.conversationId);
      return Boolean(conv && conv.participantIds.includes(viewer.personId));
    }

    case "project": {
      if (oversight) return true;
      const project = ctx.projects.find((p) => p.id === file.projectId);
      if (!project) return false;
      return project.builderId === viewer.personId || project.workerIds.includes(viewer.personId);
    }

    case "task": {
      if (oversight) return true;
      const task = ctx.tasks.find((t) => t.id === file.taskId);
      if (!task) return false;
      return task.assigneeId === viewer.personId || task.createdById === viewer.personId;
    }

    default:
      return false;
  }
}

/** Files the viewer may see, newest first. */
export function visibleFiles(
  files: FileRecord[],
  viewer: { personId: string; role: UserRole },
  ctx: FileAccessContext,
): FileRecord[] {
  return files
    .filter((f) => canAccessFile(f, viewer, ctx))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/* ---------- Upload helpers (demo mode) ---------- */

/**
 * Reads a browser File as a data URL. Used ONLY for small images so
 * chat/document previews work without a backend; real builds replace
 * this with an object-storage upload that returns a storage key.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}