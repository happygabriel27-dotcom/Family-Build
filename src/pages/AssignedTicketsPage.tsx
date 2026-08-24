/* ============================================================
   FamilyBuild — My Tickets (Customer Service & Developer)
   ------------------------------------------------------------
   Open tickets assigned to me or escalated to me, with the
   shared workflow modal (reply / status / technical notes).
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { ticketsAssignedTo, ticketsEscalatedTo } from "../data/calculations";
import type { ServiceRequest } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TicketDetailModal } from "../components/support/TicketDetailModal";
import { timeAgo } from "../utils/format";

export function AssignedTicketsPage() {
  const { user } = useApp();
  const data = useData();
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const isDeveloper = user.role === "developer";

  const mine = useMemo(() => {
    const assigned = ticketsAssignedTo(data.requests, myId);
    const escalated = ticketsEscalatedTo(data.requests, myId);
    const seen = new Set<string>();
    return [...assigned, ...escalated]
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [data.requests, myId]);

  const detail = detailId ? data.requests.find((r) => r.id === detailId) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{isDeveloper ? "Technical Tickets" : "My Assigned Tickets"}</h1>
          <p className="page-header__subtitle">
            {isDeveloper
              ? "Tickets escalated to you for technical review. Add notes and update the technical status."
              : "Tickets you are handling. Reply to customers, update status, and escalate when needed."}
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat__label">Open With Me</div>
          <div className="stat__value" style={{ color: mine.length > 0 ? "var(--warning)" : undefined }}>
            {mine.length}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">High Priority</div>
          <div className="stat__value">
            {mine.filter((t) => t.priority === "high" || t.priority === "urgent").length}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Waiting</div>
          <div className="stat__value">{mine.filter((t) => t.status === "waiting").length}</div>
        </div>
      </div>

      {mine.length === 0 ? (
        <EmptyState
          icon="🎫"
          title="No open tickets with you"
          text={
            isDeveloper
              ? "When Customer Service escalates a technical ticket to you, it appears here."
              : "Assign yourself a ticket from the Support Inbox, or ask the owner to route one to you."
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Kind</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Role</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.map((t: ServiceRequest) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>
                      <span className="ticket-number">#{t.ticketNo}</span> {t.title}
                    </td>
                    <td>{t.kind}</td>
                    <td>{data.actorName(t.submittedById)}</td>
                    <td>{data.propertyById(t.propertyId)?.name ?? "—"}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <StatusBadge status={t.priority} />
                    </td>
                    <td>
                      {t.escalatedToId === myId
                        ? "Escalated to you"
                        : t.assignedToId === myId
                          ? "Assigned"
                          : "—"}
                    </td>
                    <td>{timeAgo(t.updatedAt)}</td>
                    <td>
                      <button className="btn btn--ghost btn--sm" onClick={() => setDetailId(t.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <TicketDetailModal request={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}