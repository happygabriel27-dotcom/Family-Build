/* ============================================================
   FamilyBuild — Sign-in Announcements
   ------------------------------------------------------------
   After authentication, shows a temporary (non-blocking) modal
   with published announcements relevant to the signed-in user's
   role. Dismissing records per-user read state so the SAME
   announcement is not re-shown on every navigation or future
   sign-in; only new/unread ones appear on later logins.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext";
import { useData } from "../../store/DataContext";
import { announcementsForRole } from "../../data/calculations";
import { Modal } from "../ui/Modal";
import { STORAGE_KEYS, load, save } from "../../services/storage";
import type { Announcement } from "../../data/types";

type AnnouncementReadMap = Record<string, string[]>;

function loadReadMap(): AnnouncementReadMap {
  return load<AnnouncementReadMap>(STORAGE_KEYS.announcementReads, {});
}

function markAnnouncementsRead(personId: string, ids: string[]): void {
  const map = loadReadMap();
  const previous = new Set(map[personId] ?? []);
  ids.forEach((id) => previous.add(id));
  save(STORAGE_KEYS.announcementReads, { ...map, [personId]: [...previous] });
}

export function SignInAnnouncements() {
  const { user } = useApp();
  const data = useData();
  /* Local dismiss guard so closing during this session never re-triggers. */
  const [sessionDismissed, setSessionDismissed] = useState<string[]>([]);

  const person = user ? data.personById(user.personId) : undefined;

  /** Published + audience-matched + not expired + not yet read by this user. */
  const pending = useMemo<Announcement[]>(() => {
    if (!user || !person) return [];
    const readIds = new Set(loadReadMap()[person.id] ?? []);
    return announcementsForRole(data.announcements, user.role)
      .filter((a) => !readIds.has(a.id))
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
      .slice(0, 3);
  }, [user, person, data.announcements]);

  if (!user || !person || sessionDismissed.length >= pending.length) return null;

  const visible = pending.filter((a) => !sessionDismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <Modal title="📢 Announcements" onClose={() => setSessionDismissed(pending.map((a) => a.id))}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((a) => (
          <article key={a.id} className="card" style={{ padding: "10px 12px" }}>
            <strong>{a.title}</strong>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0" }}>{a.content}</p>
            <small style={{ color: "var(--text-subtle)" }}>
              {data.actorName(a.authorId)} · {new Date(a.publishedAt ?? a.createdAt).toLocaleDateString()}
            </small>
          </article>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            /* Persist read state so these don't reappear on future logins. */
            markAnnouncementsRead(
              person.id,
              visible.map((a) => a.id),
            );
            setSessionDismissed(visible.map((a) => a.id));
          }}
        >
          Got it
        </button>
      </div>
    </Modal>
  );
}