/* ============================================================
   FamilyBuild — Documents
   ------------------------------------------------------------
   Complete document-management area on the existing design
   language: view, create/upload, rename/edit metadata, delete,
   search, sort, filter by category, view details, download the
   linked file where available, and share into a conversation.

   Permission-aware: document.view is basic; create/edit/delete/
   share are granted per role and further limited to the
   document owner (or Owner role).
   ============================================================ */

import { useMemo, useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { can } from "../data/permissions";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Icon } from "../components/ui/Icon";
import { FileCard } from "../components/messaging/FileCard";
import {
  MAX_INLINE_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  detectFileKind,
  readFileAsDataUrl,
} from "../services/fileService";
import type { DocumentRecord, FileRecord } from "../data/types";
import { formatDate, formatDateTime } from "../utils/format";

type SortKey = "updated-desc" | "updated-asc" | "title-asc" | "title-desc" | "category";

export function DocumentsPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sort, setSort] = useState<SortKey>("updated-desc");
  const [editorDoc, setEditorDoc] = useState<DocumentRecord | "new" | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentRecord | null>(null);
  const [shareDoc, setShareDoc] = useState<DocumentRecord | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentRecord | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";

  const canCreate = can(user.role, "document.create");
  const canShare = can(user.role, "document.share");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(data.documents.map((d) => d.category))).sort()],
    [data.documents],
  );

  const filesById = useMemo(() => new Map(data.files.map((f) => [f.id, f])), [data.files]);

  const visibleDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let docs = [...data.documents];
    if (q) {
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          d.category.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== "All") docs = docs.filter((d) => d.category === categoryFilter);

    switch (sort) {
      case "updated-asc":
        docs.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        break;
      case "title-asc":
        docs.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        docs.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "category":
        docs.sort((a, b) => a.category.localeCompare(b.category) || b.updatedAt.localeCompare(a.updatedAt));
        break;
      default:
        docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return docs;
  }, [data.documents, query, categoryFilter, sort]);

  const mayEdit = (doc: DocumentRecord) =>
    can(user.role, "document.edit") && (user.role === "owner" || doc.ownerById === myId);
  const mayDelete = (doc: DocumentRecord) =>
    can(user.role, "document.delete") && (user.role === "owner" || doc.ownerById === myId);

  const myConversations = data.conversations.filter((c) => c.participantIds.includes(myId));

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

  /** Shares a document into a conversation by referencing its file
      content — no duplicated physical payload. */
  const shareToConversation = (doc: DocumentRecord, conversationId: string) => {
    const source = doc.fileId ? filesById.get(doc.fileId) : undefined;
    let attachmentIds: string[] = [];
    if (source) {
      const copy: Omit<FileRecord, "id" | "uploadedAt" | "updatedAt"> & { uploadedAt?: string } = {
        name: source.name,
        kind: source.kind,
        mimeType: source.mimeType,
        sizeBytes: source.sizeBytes,
        uploadedById: myId,
        description: `Shared document: ${doc.title}`,
        visibility: "conversation",
        conversationId,
        storageKey: source.storageKey,
        ...(source.dataUrl ? { dataUrl: source.dataUrl } : {}),
      };
      const record = data.addFileRecord(copy);
      attachmentIds = [record.id];
    }
    data.sendMessage(conversationId, myId, `Shared document: ${doc.title}`, attachmentIds);
    setShareDoc(null);
    showToast(`Document shared to ${data.conversations.find((c) => c.id === conversationId)?.subject ?? "conversation"}`, "success");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Documents</h1>
          <p className="page-header__subtitle">Organizational documents, contracts, permits, and policies.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn--primary" onClick={() => setEditorDoc("new")}>
            + New document
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <span><Icon name="search" size={14} /></span>
            <input
              type="search"
              placeholder="Search title, description, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search documents"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort documents">
            <option value="updated-desc">Newest updated</option>
            <option value="updated-asc">Oldest updated</option>
            <option value="title-asc">Title A–Z</option>
            <option value="title-desc">Title Z–A</option>
            <option value="category">Category</option>
          </select>
        </div>

        {visibleDocs.length === 0 ? (
          <EmptyState
            icon="📄"
            title={query || categoryFilter !== "All" ? "No matching documents" : "No documents yet"}
            text={
              query || categoryFilter !== "All"
                ? "Adjust your search or filter."
                : canCreate
                  ? "Create your first document to get started."
                  : "Documents will appear here once created."
            }
            action={
              !query && categoryFilter === "All" && canCreate ? (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditorDoc("new")}>
                  + New document
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Owner</th>
                  <th>Related</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleDocs.map((doc) => {
                  const file = doc.fileId ? filesById.get(doc.fileId) : undefined;
                  return (
                    <tr key={doc.id}>
                      <td>
                        <button type="button" className="doc-title-btn" onClick={() => setDetailDoc(doc)}>
                          <strong>{doc.title}</strong>
                          {file && <small className="doc-file-hint">📎 {file.name}</small>}
                          {doc.tags.length > 0 && (
                            <span className="doc-tags">{doc.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</span>
                          )}
                        </button>
                      </td>
                      <td><span className="badge badge--info">{doc.category}</span></td>
                      <td>{data.actorName(doc.ownerById)}</td>
                      <td>
                        {doc.projectId ? data.projectById(doc.projectId)?.name : ""}
                        {!doc.projectId && doc.propertyId ? data.propertyById(doc.propertyId)?.name : ""}
                        {!doc.projectId && !doc.propertyId ? "—" : ""}
                      </td>
                      <td>{formatDate(doc.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDetailDoc(doc)} title="View details">
                            <Icon name="eye" size={14} />
                          </button>
                          {mayEdit(doc) && (
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditorDoc(doc)} title="Edit metadata">
                              <Icon name="edit" size={14} />
                            </button>
                          )}
                          {canShare && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => (myConversations.length > 0 ? setShareDoc(doc) : showToast("You have no conversations to share into yet.", "info"))}
                              title="Share to conversation"
                            >
                              <Icon name="send" size={14} />
                            </button>
                          )}
                          {mayDelete(doc) && (
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleteDoc(doc)} title="Delete">
                              <Icon name="trash" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Create / edit metadata ---------- */}
      {editorDoc && (
        <DocumentEditorModal
          document={editorDoc === "new" ? null : editorDoc}
          onClose={() => setEditorDoc(null)}
          onSave={(input, browserFile) => {
            if (editorDoc === "new") {
              let fileId: string | undefined;
              if (browserFile) {
                const kind = detectFileKind(browserFile.name, browserFile.type);
                void (async () => {
                  let dataUrl: string | undefined;
                  if (kind === "image" && browserFile.size <= MAX_INLINE_IMAGE_BYTES) {
                    try {
                      dataUrl = await readFileAsDataUrl(browserFile);
                    } catch {
                      /* preview unavailable */
                    }
                  }
                  const record = data.addFileRecord({
                    name: browserFile.name,
                    kind,
                    mimeType: browserFile.type || "application/octet-stream",
                    sizeBytes: browserFile.size,
                    uploadedById: myId,
                    visibility: "private",
                    storageKey: `mock://documents/${Date.now()}-${browserFile.name}`,
                    ...(dataUrl ? { dataUrl } : {}),
                  });
                  fileId = record.id;
                  const doc = data.addDocument({ ...input, ownerById: myId, fileId });
                  setEditorDoc(null);
                  showToast(`Document "${doc.title}" created`, "success");
                })();
                return;
              }
              const doc = data.addDocument({ ...input, ownerById: myId });
              setEditorDoc(null);
              showToast(`Document "${doc.title}" created`, "success");
            } else {
              data.updateDocument(editorDoc.id, input);
              setEditorDoc(null);
              showToast("Document updated", "success");
            }
          }}
          maxUploadBytes={MAX_UPLOAD_BYTES}
        />
      )}

      {/* ---------- Details ---------- */}
      {detailDoc && (
        <Modal title={detailDoc.title} subtitle={`${detailDoc.category}`} onClose={() => setDetailDoc(null)} wide>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-item__label">Owner</div>
              <div className="info-item__value">{data.actorName(detailDoc.ownerById)}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Created</div>
              <div className="info-item__value">{formatDateTime(detailDoc.createdAt)}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Last updated</div>
              <div className="info-item__value">{formatDateTime(detailDoc.updatedAt)}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Related project</div>
              <div className="info-item__value">{detailDoc.projectId ? (data.projectById(detailDoc.projectId)?.name ?? "—") : "—"}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Related property</div>
              <div className="info-item__value">{detailDoc.propertyId ? (data.propertyById(detailDoc.propertyId)?.name ?? "—") : "—"}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Tags</div>
              <div className="info-item__value">{detailDoc.tags.length > 0 ? detailDoc.tags.map((t) => `#${t}`).join(" ") : "—"}</div>
            </div>
          </div>
          {detailDoc.description && (
            <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--text-muted)" }}>{detailDoc.description}</p>
          )}
          {detailDoc.fileId && filesById.get(detailDoc.fileId) && (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 13, marginBottom: 8 }}>Attached file</h3>
              <FileCard file={filesById.get(detailDoc.fileId)!} onOpenImage={(f) => downloadFile(f)} onDownload={downloadFile} />
            </div>
          )}
        </Modal>
      )}

      {/* ---------- Share to conversation ---------- */}
      {shareDoc && (
        <Modal title={`Share “${shareDoc.title}”`} subtitle="Send this document into one of your conversations." onClose={() => setShareDoc(null)}>
          <div className="form-group">
            <label htmlFor="share-conv">Conversation</label>
            <select id="share-conv" defaultValue={myConversations[0]?.id ?? ""}>
              {myConversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === "group" ? `👥 ${c.subject}` : `${c.subject}`}
                </option>
              ))}
            </select>
          </div>
          <div className="modal__footer" style={{ padding: 0, border: "none", marginTop: 16 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setShareDoc(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={myConversations.length === 0}
              onClick={() => shareToConversation(shareDoc, (document.getElementById("share-conv") as HTMLSelectElement).value)}
            >
              Share
            </button>
          </div>
        </Modal>
      )}

      {/* ---------- Delete confirm ---------- */}
      {deleteDoc && (
        <ConfirmDialog
          title="Delete document?"
          message={`"${deleteDoc.title}" will be removed. The linked file record stays in Files unless deleted separately.`}
          confirmLabel="Delete document"
          danger
          onConfirm={() => {
            data.deleteDocument(deleteDoc.id);
            setDeleteDoc(null);
            showToast("Document deleted", "success");
          }}
          onCancel={() => setDeleteDoc(null)}
        />
      )}
    </div>
  );
}

/* ---------- Editor modal ---------- */

function DocumentEditorModal({
  document,
  onClose,
  onSave,
  maxUploadBytes,
}: {
  document: DocumentRecord | null;
  onClose: () => void;
  onSave: (
    input: { title: string; description?: string; category: string; tags: string[]; projectId?: string; propertyId?: string },
    browserFile: File | null,
  ) => void;
  maxUploadBytes: number;
}) {
  const { user } = useApp();
  const data = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(document?.title ?? "");
  const [category, setCategory] = useState(document?.category ?? "");
  const [description, setDescription] = useState(document?.description ?? "");
  const [tagsText, setTagsText] = useState(document?.tags.join(", ") ?? "");
  const [projectId, setProjectId] = useState(document?.projectId ?? "");
  const [propertyId, setPropertyId] = useState(document?.propertyId ?? "");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingCategories = Array.from(new Set(data.documents.map((d) => d.category))).sort();

  const submit = () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!document && pickedFile && pickedFile.size > maxUploadBytes) {
      setError(`File too large — demo uploads are capped at ${Math.round(maxUploadBytes / 1_000_000)} MB.`);
      return;
    }
    onSave(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || "General",
        tags: tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        projectId: projectId || undefined,
        propertyId: propertyId || undefined,
      },
      document ? null : pickedFile,
    );
  };

  return (
    <Modal
      title={document ? "Edit document metadata" : "New document"}
      subtitle={document ? "Update title, category, tags, and links." : "Attach an optional file and describe the document."}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {document ? "Save changes" : "Create document"}
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="doc-title">Title *</label>
        <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Building Permit Amendment" />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="doc-category">Category</label>
        <input
          id="doc-category"
          list="doc-category-options"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Contracts, Permits, Reports…"
        />
        <datalist id="doc-category-options">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="doc-description">Description</label>
        <textarea id="doc-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label htmlFor="doc-tags">Tags (comma separated)</label>
        <input id="doc-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="contract, riverside" />
      </div>
      <div className="form-row-2">
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="doc-project">Related project</label>
          <select id="doc-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— None —</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="doc-property">Related property</label>
          <select id="doc-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">— None —</option>
            {data.properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      {!document && (
        <div className="form-group">
          <label>Attach file (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
            aria-label="Attach a file to this document"
          />
          {pickedFile && <small style={{ color: "var(--text-muted)" }}>{pickedFile.name}</small>}
        </div>
      )}
      {error && (
        <div className="form-errors" role="alert" style={{ marginTop: 10 }}>
          <div>{error}</div>
        </div>
      )}
      {user && null}
    </Modal>
  );
}