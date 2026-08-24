/* ============================================================
   FamilyBuild — Announcements
   ------------------------------------------------------------
   Owner: create, edit, publish, unpublish, archive, delete.
   Everyone else: read-only list of published announcements
   targeted at their audience. Publishing notifies recipients.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { can } from "../data/permissions";
import { announcementsForRole } from "../data/calculations";
import type { Announcement, AnnouncementAudience } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Avatar } from "../components/ui/Avatar";
import { formatDateTime, timeAgo } from "../utils/format";

const AUDIENCES: AnnouncementAudience[] = [
  "EVERYONE",
  "DEVELOPERS",
  "WORKERS",
  "CUSTOMER_SERVICE",
];

export function AnnouncementsPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  if (!user) return null;
  const role = user.role;
  const canManageAnnouncements =
    can(role, "announcement.create") ||
    can(role, "announcement.edit") ||
    can(role, "announcement.publish") ||
    can(role, "announcement.delete");

  const visible = useMemo(
    () => announcementsForRole(data.announcements, role),
    [data.announcements, role],
  );

  const allForOwner = useMemo(
    () => [...data.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.announcements],
  );

  const list = canManageAnnouncements ? allForOwner : visible;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Announcements</h1>
          <p className="page-header__subtitle">
            {canManageAnnouncements
              ? "Publish company-wide or role-targeted announcements. Recipients are notified automatically."
              : "News and updates from the FamilyBuild team."}
          </p>
        </div>
        <div className="page-header__actions">
          {canManageAnnouncements && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + New Announcement
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="📣"
          title="No announcements yet"
          text={
            canManageAnnouncements
              ? "Create your first announcement to keep everyone informed."
              : "Announcements for your role will appear here."
          }
          action={
            canManageAnnouncements ? (
              <button
                className="btn btn--primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                + New Announcement
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="announcement-list">
          {list.map((a) => {
            const author = data.personById(a.authorId);
            const canEdit = canManageAnnouncements;
            return (
              <article key={a.id} className="card announcement-card">
                <div className="announcement-card__head">
                  <Avatar name={author?.name ?? "?"} size={32} />
                  <div className="announcement-card__meta">
                    <h3>{a.title}</h3>
                    <small>
                      {author?.name ?? "—"} · {a.audience.replace("_", " ").toLowerCase()} ·{" "}
                      {a.status === "published" && a.publishedAt
                        ? `published ${timeAgo(a.publishedAt)}`
                        : `created ${timeAgo(a.createdAt)}`}
                    </small>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <p className="announcement-card__content">{a.content}</p>
                {canEdit && (
                  <div className="announcement-card__actions">
                    {a.status === "draft" && (
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => {
                          data.setAnnouncementStatus(a.id, "published", user.personId);
                          showToast("Announcement published — audience notified", "success");
                        }}
                      >
                        Publish
                      </button>
                    )}
                    {a.status === "published" && (
                      <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => {
                          data.setAnnouncementStatus(a.id, "draft", user.personId);
                          showToast("Announcement unpublished", "info");
                        }}
                      >
                        Unpublish
                      </button>
                    )}
                    {a.status !== "archived" && (
                      <button
                        className="btn btn--sm btn--ghost"
                        onClick={() => {
                          data.setAnnouncementStatus(a.id, "archived", user.personId);
                          showToast("Announcement archived", "info");
                        }}
                      >
                        Archive
                      </button>
                    )}
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        setEditing(a);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn--sm btn--ghost" onClick={() => setDeleteTarget(a)}>
                      Delete
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {formOpen && (
        <AnnouncementFormModal
          announcement={editing}
          defaultAuthorId={user.personId}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            if (editing) {
              data.updateAnnouncement(editing.id, input);
              showToast("Announcement updated", "success");
            } else {
              data.addAnnouncement(input);
              showToast("Announcement saved as draft — publish when ready", "success");
            }
            setFormOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete announcement?"
          message={`"${deleteTarget.title}" will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            data.deleteAnnouncement(deleteTarget.id);
            showToast("Announcement deleted", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function AnnouncementFormModal({
  announcement,
  defaultAuthorId,
  onClose,
  onSubmit,
}: {
  announcement: Announcement | null;
  defaultAuthorId: string;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    content: string;
    authorId: string;
    audience: AnnouncementAudience;
    expiresAt?: string;
  }) => void;
}) {
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");
  const [audience, setAudience] = useState<AnnouncementAudience>(announcement?.audience ?? "EVERYONE");
  const [expiresAt, setExpiresAt] = useState(announcement?.expiresAt?.slice(0, 10) ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Title is required.");
    if (!content.trim()) errs.push("Content is required.");
    setErrors(errs);
    if (errs.length > 0) return;
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      authorId: announcement?.authorId ?? defaultAuthorId,
      audience,
      expiresAt: expiresAt || undefined,
    });
  };

  return (
    <Modal
      wide
      title={announcement ? "Edit announcement" : "New announcement"}
      subtitle="Saved as a draft first — publish to notify the audience."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {announcement ? "Save changes" : "Save draft"}
          </button>
        </>
      }
    >
      {errors.length > 0 && (
        <div className="form-errors" role="alert">
          {errors.map((e) => (
            <div key={e}>• {e}</div>
          ))}
        </div>
      )}
      <div className="form-grid">
        <div className="form-group form-group--full">
          <label htmlFor="ann-title">Title *</label>
          <input
            id="ann-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Typhoon readiness — secure all active sites"
          />
        </div>
        <div className="form-group">
          <label htmlFor="ann-audience">Audience</label>
          <select
            id="ann-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
          >
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ann-expires">Expires on (optional)</label>
          <input id="ann-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="ann-content">Content *</label>
          <textarea
            id="ann-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the announcement. Blank lines create paragraphs."
          />
        </div>
      </div>
      {announcement?.publishedAt && (
        <p style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 8 }}>
          First published {formatDateTime(announcement.publishedAt)}.
        </p>
      )}
    </Modal>
  );
}