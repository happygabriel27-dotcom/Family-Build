/* ============================================================
   FamilyBuild — Shared Support Ticket Detail Modal
   ------------------------------------------------------------
   One modal drives the whole support workflow for every role:
   - Customer Service: assign, reply, change status, escalate
   - Owner: full control incl. override/resolve + escalation
   - Developer: technical notes + status on escalated tickets
   - Builder: reply/status on tickets they handle
   - Property Owner: reply to their own tickets, follow timeline
   Permissions come from the centralized can() layer.
   ============================================================ */

import { useState } from "react";
import { useApp } from "../../store/AppContext";
import { useData } from "../../store/DataContext";
import { can } from "../../data/permissions";
import type { RequestStatus, ServiceRequest } from "../../data/types";
import { StatusBadge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";

const REQUEST_STATUSES: RequestStatus[] = [
  "submitted",
  "under-review",
  "assigned",
  "in-progress",
  "waiting",
  "resolved",
  "closed",
];

export function TicketDetailModal({
  request,
  onClose,
}: {
  request: ServiceRequest;
  onClose: () => void;
}) {
  const { user, showToast } = useApp();
  const data = useData();

  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState(request.assignedToId ?? "");
  const [escalateTo, setEscalateTo] = useState("");
  const [escalateReason, setEscalateReason] = useState("");

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  const property = data.propertyById(request.propertyId);
  const submitter = data.personById(request.submittedById);

  /* ---------- permissions ---------- */
  const mayAssign = can(role, "support.assign");
  const mayStatus = can(role, "support.status");
  const mayResolve = can(role, "support.resolve");
  const mayReply = can(role, "support.reply") || can(role, "support.viewOwn");
  const mayEscalate = can(role, "support.escalate");
  const isMyTicket =
    request.assignedToId === myId || request.escalatedToId === myId;

  // Developers only act on tickets escalated to them.
  const developerLocked = role === "developer" && !isMyTicket;

  // Handlers allowed in the assign dropdown per role.
  const assignableHandlers = data.people.filter((p) => {
    if (p.kind === "admin") return false;
    if (role === "customer-service") {
      return p.kind === "customer-service" || p.kind === "builder" || p.kind === "developer";
    }
    return true; // owner sees everyone
  });

  const escalationTargets = data.people.filter(
    (p) =>
      (p.kind === "developer" || p.kind === "admin" || p.id !== myId) &&
      p.status === "active" &&
      p.id !== request.submittedById,
  );

  const changeStatus = (next: RequestStatus) => {
    data.updateRequestStatus(request.id, next, myId, note.trim() || undefined);
    setNote("");
    showToast(`Ticket #${request.ticketNo} → ${next.replace("-", " ")}`, "success");
  };

  const doAssign = () => {
    if (!assignee) {
      showToast("Choose someone to assign the ticket to.", "error");
      return;
    }
    data.assignTicket(request.id, assignee, myId, note.trim() || undefined);
    setNote("");
    showToast(`Ticket #${request.ticketNo} assigned`, "success");
  };

  const doEscalate = () => {
    if (!escalateTo) {
      showToast("Choose who to escalate this ticket to.", "error");
      return;
    }
    if (!escalateReason.trim()) {
      showToast("Add a short reason for the escalation.", "error");
      return;
    }
    data.escalateTicket(request.id, escalateTo, escalateReason.trim(), myId);
    setEscalateReason("");
    showToast(`Ticket #${request.ticketNo} escalated`, "success");
  };

  const doReply = () => {
    if (!note.trim()) return;
    data.replyTicket(request.id, myId, note.trim());
    setNote("");
    showToast("Reply added", "success");
  };

  return (
    <Modal
      wide
      title={`#${request.ticketNo} ${request.title}`}
      subtitle={`${property?.name ?? "—"} · ${request.category} · submitted by ${submitter?.name ?? "—"}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="task-detail-grid">
        <div>
          <div className="info-grid" style={{ marginBottom: 16 }}>
            <div className="info-item">
              <div className="info-item__label">Status</div>
              <div className="info-item__value">
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Priority</div>
              <div className="info-item__value">
                <StatusBadge status={request.priority} />
              </div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Assigned to</div>
              <div className="info-item__value">
                {request.assignedToId ? data.actorName(request.assignedToId) : "Unassigned"}
              </div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Escalated to</div>
              <div className="info-item__value">
                {request.escalatedToId ? data.actorName(request.escalatedToId) : "—"}
                {request.escalationReason ? (
                  <small style={{ display: "block", color: "var(--text-muted)" }}>
                    {request.escalationReason}
                  </small>
                ) : null}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16 }}>
            {request.description}
          </p>

          {/* ---------- Workflow actions ---------- */}
          {!developerLocked && (
            <>
              {mayAssign && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="card__header">
                    <h3 className="card__title">Assign ticket</h3>
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label htmlFor={`tk-assign-${request.id}`}>Assign to</label>
                    <select
                      id={`tk-assign-${request.id}`}
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {assignableHandlers.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} — {h.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn btn--sm btn--primary" onClick={doAssign}>
                    Assign
                  </button>
                </div>
              )}

              {mayEscalate && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="card__header">
                    <h3 className="card__title">Escalate</h3>
                    <p className="card__subtitle">Technical problems → Developer · Management decisions → Owner</p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label htmlFor={`tk-esc-${request.id}`}>Escalate to</label>
                    <select
                      id={`tk-esc-${request.id}`}
                      value={escalateTo}
                      onChange={(e) => setEscalateTo(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {escalationTargets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label htmlFor={`tk-escreason-${request.id}`}>Reason *</label>
                    <input
                      id={`tk-escreason-${request.id}`}
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      placeholder="e.g. Needs platform-side investigation"
                    />
                  </div>
                  <button type="button" className="btn btn--sm btn--secondary" onClick={doEscalate}>
                    Escalate ticket
                  </button>
                </div>
              )}

              {(mayStatus || isMyTicket) && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="card__header">
                    <h3 className="card__title">Change status</h3>
                  </div>
                  <div className="status-actions">
                    {REQUEST_STATUSES.filter((s) => s !== request.status)
                      .filter((s) => (mayResolve ? true : s !== "resolved"))
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="btn btn--sm btn--secondary"
                          onClick={() => changeStatus(s)}
                        >
                          → {s.replace("-", " ")}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------- Reply box ---------- */}
          {mayReply && !["resolved", "closed"].includes(request.status) && (
            <div className="card">
              <div className="card__header">
                <h3 className="card__title">Reply</h3>
              </div>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a reply visible to the customer and handlers…"
                aria-label="Reply text"
              />
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn--sm btn--primary" disabled={!note.trim()} onClick={doReply}>
                  Send reply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Timeline ---------- */}
        <div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card__header">
              <h3 className="card__title">Timeline ({request.updates.length})</h3>
            </div>
            <ul className="timeline">
              <li className="timeline__item">
                <span className="timeline__dot timeline__dot--submitted" />
                <div>
                  <strong>Submitted</strong>
                  <p>{new Date(request.createdAt).toLocaleString()}</p>
                </div>
              </li>
              {request.updates.map((u) => (
                <li key={u.id} className="timeline__item">
                  <Avatar name={data.actorName(u.authorId)} size={22} />
                  <div>
                    <strong>{data.actorName(u.authorId)}</strong>
                    {u.status && <StatusBadge status={u.status} />}
                    <p>{u.text}</p>
                    <time>{new Date(u.createdAt).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}