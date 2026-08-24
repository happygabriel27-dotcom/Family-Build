/* ============================================================
   FamilyBuild — Files
   ------------------------------------------------------------
   Workplace file management on the existing service/data
   architecture: upload, view, search, filter by type, sort,
   rename/edit, download where supported, share into a
   conversation, and delete.

   Authorization: only files the viewer may access are listed
   (fileService.canAccessFile). Uploads can be linked to a
   project/task/conversation — the file then inherits that
   parent's authorization scope.
   ============================================================ */

import { useMemo, useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { can } from "../data/permissions";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Icon } from "../components/ui/Icon";
import {
  MAX_INLINE_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  detectFileKind,
  formatFileSize,
  readFileAsDataUrl,
  visibleFiles,
} from "../services/fileService";
import type { FileRecord } from "../data/types";
import { formatDate, formatDateTime } from "../utils/format";

type KindFilter = "all" | "image" | "pdf" | "spreadsheet" | "document" | "other";
type SortKey = "updated-desc" | "updated-asc" | "name-asc" | "name-desc" | "size-desc";

const KIND_LABELS: Record<KindFilter, string> = {
  all: "All types",
  image: "Images",
  pdf: "PDF",
  spreadsheet: "Spreadsheets",
  document: "Documents",
  other: "Other",
};

export function FilesPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated-desc");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editFile, setEditFile] = useState<FileRecord | null>(null);
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [deleteFile, setDeleteFile] = useState<FileRecord | null>(null);
  const [lightbox, setLightbox] = useState<FileRecord | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";

  const canUpload = can(user.role, "file.upload");
  const canEditAny = can(user.role, "file.edit");
  const canDeleteAny = can(user.role, "file.delete");
  const canShare = can(user.role, "file.share");

  const visible = useMemo(
    () =>
      visibleFiles(data.files, { personId: myId, role: user.role }, data),
    [data.files, data.people, data.projects, data.tasks, data.conversations, myId, user.role],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...visible];
    if (q) {
      list = list.filter(
        (f) => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q),
      );
    }
    if (kindFilter !== "all") {
      list =
        kindFilter === "other"
          ? list.filter((f) => !["image", "pdf", "spreadsheet", "document"].includes(f.kind))
          : list.filter((f) => f.kind === kindFilter);
    }
    switch (sort) {
      case "updated-asc":
        list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "size-desc":
        list.sort((a, b) => b.sizeBytes - a.sizeBytes);
        break;
      default:
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return list;
  }, [visible, query, kindFilter, sort]);

  const relatedLabel = (f: FileRecord): string => {
    if (f.taskId) return `Task · ${data.tasks.find((t) => t.id === f.taskId)?.title ?? ""}`;
    if (f.projectId) return `Project · ${data.projectById(f.projectId)?.name ?? ""}`;
    if (f.conversationId) {
      const conv = data.conversations.find((c) => c.id === f.conversationId);
      return conv ? `${conv.kind === "group" ? "Group" : "Chat"} · ${conv.subject}` : "";
    }
    return "";
  };

  const mayManage = (f: FileRecord) => f.uploadedById === myId || user.role === "owner" || canEditAny;

  const downloadFile = (file: FileRecord) => {
    if (!file.dataUrl) {
      showToast("Demo build — binary content is not stored locally for this file.", "info");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = file.dataUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const myConversations = data.conversations.filter((c) => c.participantIds.includes(myId));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Files</h1>
          <p className="page-header__subtitle">Shared workplace files. Access follows each file's project, task, or conversation.</p>
        </div>
        {canUpload && (
          <button type="button" className="btn btn--primary" onClick={() => setUploadOpen(true)}>
            + Upload file
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <span><Icon name="search" size={14} /></span>
            <input
              type="search"
              placeholder="Search file names…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search files"
            />
          </div>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} aria-label="Filter by type">
            {(Object.keys(KIND_LABELS) as KindFilter[]).map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort files">
            <option value="updated-desc">Newest</option>
            <option value="updated-asc">Oldest</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="size-desc">Largest first</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="📁"
            title={query || kindFilter !== "all" ? "No matching files" : "No files yet"}
            text={
              query || kindFilter !== "all"
                ? "Adjust your search or filter."
                : canUpload
                  ? "Upload your first file to get started."
                  : "Files shared with you will appear here."
            }
            action={
              !query && kindFilter === "all" && canUpload ? (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setUploadOpen(true)}>
                  + Upload file
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded by</th>
                  <th>Related to</th>
                  <th>Access</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <button
                        type="button"
                        className="doc-title-btn"
                        onClick={() => (file.kind === "image" && file.dataUrl ? setLightbox(file) : downloadFile(file))}
                      >
                        <strong>{file.name}</strong>
                        {file.description && <small>{file.description}</small>}
                      </button>
                    </td>
                    <td><span className={`badge badge--info`}>{file.kind}</span></td>
                    <td>{formatFileSize(file.sizeBytes)}</td>
                    <td>{data.actorName(file.uploadedById)}</td>
                    <td>{relatedLabel(file) || "—"}</td>
                    <td><span className="badge">{file.visibility}</span></td>
                    <td title={formatDateTime(file.updatedAt)}>{formatDate(file.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        {file.kind === "image" && file.dataUrl && (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLightbox(file)} title="View image">
                            <Icon name="eye" size={14} />
                          </button>
                        )}
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => downloadFile(file)} title="Download / open">
                          <Icon name="download" size={14} />
                        </button>
                        {mayManage(file) && (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditFile(file)} title="Rename / edit">
                            <Icon name="edit" size={14} />
                          </button>
                        )}
                        {canShare && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() =>
                              myConversations.length > 0
                                ? setShareFile(file)
                                : showToast("You have no conversations to share into yet.", "info")
                            }
                            title="Share to conversation"
                          >
                            <Icon name="send" size={14} />
                          </button>
                        )}
                        {(canDeleteAny || file.uploadedById === myId) && (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleteFile(file)} title="Delete">
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Upload ---------- */}
      {uploadOpen && (
        <UploadFileModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            showToast("File uploaded", "success");
          }}
        />
      )}

      {/* ---------- Rename / edit ---------- */}
      {editFile && (
        <EditFileModal
          file={editFile}
          onClose={() => setEditFile(null)}
          onSave={(patch) => {
            data.updateFileRecord(editFile.id, patch);
            setEditFile(null);
            showToast("File updated", "success");
          }}
        />
      )}

      {/* ---------- Share ---------- */}
      {shareFile && (
        <Modal title={`Share “${shareFile.name}”`} subtitle="Send this file into one of your conversations." onClose={() => setShareFile(null)}>
          <div className="form-group">
            <label htmlFor="share-file-conv">Conversation</label>
            <select id="share-file-conv" defaultValue={myConversations[0]?.id ?? ""}>
              {myConversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === "group" ? `👥 ${c.subject}` : c.subject}
                </option>
              ))}
            </select>
          </div>
          <div className="modal__footer" style={{ padding: 0, border: "none", marginTop: 16 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setShareFile(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={myConversations.length === 0}
              onClick={() => {
                const conversationId = (document.getElementById("share-file-conv") as HTMLSelectElement).value;
                const copy: Omit<FileRecord, "id" | "uploadedAt" | "updatedAt"> & { uploadedAt?: string } = {
                  name: shareFile.name,
                  kind: shareFile.kind,
                  mimeType: shareFile.mimeType,
                  sizeBytes: shareFile.sizeBytes,
                  uploadedById: myId,
                  description: shareFile.description,
                  visibility: "conversation",
                  conversationId,
                  storageKey: shareFile.storageKey,
                  ...(shareFile.dataUrl ? { dataUrl: shareFile.dataUrl } : {}),
                };
                const record = data.addFileRecord(copy);
                data.sendMessage(conversationId, myId, `Shared file: ${shareFile.name}`, [record.id]);
                setShareFile(null);
                showToast("File shared to conversation", "success");
              }}
            >
              Share
            </button>
          </div>
        </Modal>
      )}

      {/* ---------- Delete ---------- */}
      {deleteFile && (
        <ConfirmDialog
          title="Delete file?"
          message={`"${deleteFile.name}" will be removed from Files. Messages referencing it will show it as unavailable.`}
          confirmLabel="Delete file"
          danger
          onConfirm={() => {
            data.deleteFileRecord(deleteFile.id);
            setDeleteFile(null);
            showToast("File deleted", "success");
          }}
          onCancel={() => setDeleteFile(null)}
        />
      )}

      {/* ---------- Image lightbox ---------- */}
      {lightbox && (
        <Modal title={lightbox.name} subtitle={`${lightbox.kind} · ${formatFileSize(lightbox.sizeBytes)}`} onClose={() => setLightbox(null)} wide>
          <div className="lightbox">
            {lightbox.dataUrl ? (
              <img src={lightbox.dataUrl} alt={lightbox.name} />
            ) : (
              <EmptyState icon="🖼️" title="No preview available" text="This demo file has no inline preview stored." />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Upload modal ---------- */

function UploadFileModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const { user } = useApp();
  const data = useData();
  const inputRef = useRef<HTMLInputElement>(null);

  const [picked, setPicked] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [linkTarget, setLinkTarget] = useState<"none" | "project" | "task" | "conversation">("none");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";

  const submit = async () => {
    if (!picked) {
      setError("Choose a file to upload.");
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError(`File too large — demo uploads are capped at ${Math.round(MAX_UPLOAD_BYTES / 1_000_000)} MB.`);
      return;
    }
    setBusy(true);
    const kind = detectFileKind(picked.name, picked.type);
    let dataUrl: string | undefined;
    if (kind === "image" && picked.size <= MAX_INLINE_IMAGE_BYTES) {
      try {
        dataUrl = await readFileAsDataUrl(picked);
      } catch {
        /* preview unavailable */
      }
    }
    data.addFileRecord({
      name: picked.name,
      kind,
      mimeType: picked.type || "application/octet-stream",
      sizeBytes: picked.size,
      uploadedById: myId,
      description: description.trim() || undefined,
      visibility:
        linkTarget === "conversation"
          ? "conversation"
          : linkTarget === "project"
            ? "project"
            : linkTarget === "task"
              ? "task"
              : "private",
      projectId: linkTarget === "project" ? projectId : undefined,
      taskId: linkTarget === "task" ? taskId : undefined,
      conversationId: linkTarget === "conversation" ? conversationId : undefined,
      storageKey: `mock://uploads/${Date.now()}-${picked.name}`,
      ...(dataUrl ? { dataUrl } : {}),
    });
    setBusy(false);
    onUploaded();
  };

  return (
    <Modal
      title="Upload file"
      subtitle="Link the file to a project, task, or conversation so the right people can access it."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>File *</label>
        <input ref={inputRef} type="file" onChange={(e) => setPicked(e.target.files?.[0] ?? null)} aria-label="Choose file" />
        {picked && (
          <small style={{ color: "var(--text-muted)" }}>
            {picked.name} · {formatFileSize(picked.size)}
          </small>
        )}
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="uf-description">Description</label>
        <input id="uf-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note about this file" />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="uf-target">Access scope</label>
        <select id="uf-target" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value as typeof linkTarget)}>
          <option value="none">Private (only you & Owner)</option>
          <option value="project">Project members</option>
          <option value="task">Task members</option>
          <option value="conversation">Conversation participants</option>
        </select>
      </div>
      {linkTarget === "project" && (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="uf-project">Project</label>
          <select id="uf-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Select project —</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      {linkTarget === "task" && (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="uf-task">Task</label>
          <select id="uf-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">— Select task —</option>
            {data.tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}
      {linkTarget === "conversation" && (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="uf-conversation">Conversation</label>
          <select id="uf-conversation" value={conversationId} onChange={(e) => setConversationId(e.target.value)}>
            <option value="">— Select conversation —</option>
            {data.conversations
              .filter((c) => c.participantIds.includes(myId))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === "group" ? `👥 ${c.subject}` : c.subject}
                </option>
              ))}
          </select>
        </div>
      )}
      {error && (
        <div className="form-errors" role="alert">
          <div>{error}</div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Edit modal ---------- */

function EditFileModal({
  file,
  onClose,
  onSave,
}: {
  file: FileRecord;
  onClose: () => void;
  onSave: (patch: Partial<FileRecord>) => void;
}) {
  const [name, setName] = useState(file.name);
  const [description, setDescription] = useState(file.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError("File name is required.");
      return;
    }
    onSave({ name: name.trim(), description: description.trim() || undefined });
  };

  return (
    <Modal
      title="Rename / edit file"
      subtitle={`Uploaded ${formatDateTime(file.uploadedAt)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Save changes
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="ef-name">File name *</label>
        <input id="ef-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label htmlFor="ef-description">Description</label>
        <input id="ef-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && (
        <div className="form-errors" role="alert" style={{ marginTop: 10 }}>
          <div>{error}</div>
        </div>
      )}
    </Modal>
  );
}