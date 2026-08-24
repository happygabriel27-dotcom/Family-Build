/* ============================================================
   FamilyBuild — Support Inbox (Customer Service + Owner)
   ------------------------------------------------------------
   All tickets in one queue with filters. CS can assign, reply,
   change status, and escalate; Owner has full override.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { openTickets, unassignedTickets } from "../data/calculations";
import type { RequestKind, RequestStatus, ServiceRequest } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TicketDetailModal } from "../components/support/TicketDetailModal";
import { timeAgo } from "../utils/format";

const STATUSES: RequestStatus[] = [
  "submitted",
  "under-review",
  "assigned",
  "in-progress",
  "waiting",
  "resolved",
  "closed",
];

type QueueView = "open" | RequestStatus | "escalated";

/** Maps sidebar queue links (?queue=…) to inbox filters. */
function queueFromSearch(search: string): QueueView | null {
  const q = new URLSearchParams(search).get("queue");
  if (!q) return null;
  if (q === "open" || q === "escalated") return q;
  if (["submitted", "under-review", "assigned", "in-progress", "waiting", "resolved", "closed"].includes(q)) {
    return q as RequestStatus;
  }
  return null;
}

export function SupportInboxPage() {
  const { user } = useApp();
  const data = useData();
  const location = useLocation();

  const [kindFilter, setKindFilter] = useState<"all" | RequestKind>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | QueueView>("open");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  /* Sidebar queue links drive the filter reactively. */
  useEffect(() => {
    const queue = queueFromSearch(location.search);
    if (queue) setStatusFilter(queue);
  }, [location.search]);

  if (!user) return null;

  const all = useMemo(
    () => [...data.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.requests],
  );

  const filtered = all.filter((r) => {
    if (kindFilter !== "all" && r.kind !== kindFilter) return false;
    if (statusFilter === "open" ? !openTickets([r]).length : false) return false;
    if (statusFilter === "escalated" ? !r.escalatedToId : false) return false;
    if (
      statusFilter !== "open" &&
      statusFilter !== "escalated" &&
      r.status !== statusFilter
    )
      return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `#${r.ticketNo} ${r.title} ${r.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const open = openTickets(all);
  const unassigned = unassignedTickets(all);
  const highPriority = open.filter((t) => t.priority === "high" || t.priority === "urgent");
  const waiting = open.filter((t) => t.status === "waiting");

  const detail = detailId ? data.requests.find((r) => r.id === detailId) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Support Inbox</h1>
          <p className="page-header__subtitle">
            Every customer request and problem in one queue. Assign, reply, escalate, and resolve.
          </p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label="Search tickets"
          />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | RequestKind)}
            className="toolbar-select"
            aria-label="Filter by kind"
          >
            <option value="all">All kinds</option>
            <option value="request">Requests</option>
            <option value="problem">Problems</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "open" | QueueView)}
            className="toolbar-select"
            aria-label="Filter by status"
          >
            <option value="open">Open (needs action)</option>
            <option value="escalated">Escalated</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("-", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat__label">Open Tickets</div>
          <div className="stat__value" style={{ color: open.length > 0 ? "var(--warning)" : undefined }}>
            {open.length}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Unassigned</div>
          <div className="stat__value" style={{ color: unassigned.length > 0 ? "var(--danger)" : undefined }}>
            {unassigned.length}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">High Priority</div>
          <div className="stat__value">{highPriority.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Waiting</div>
          <div className="stat__value">{waiting.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Resolved / Closed</div>
          <div className="stat__value">
            {all.filter((t) => t.status === "resolved" || t.status === "closed").length}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🎫"
          title={all.length === 0 ? "No tickets yet" : "No tickets match your filters"}
          text={
            all.length === 0
              ? "When property owners submit requests or problems, they appear here."
              : "Try a different filter or search."
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
                  <th>Assigned to</th>
                  <th>Escalated to</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: ServiceRequest) => (
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
                    <td>{t.assignedToId ? data.actorName(t.assignedToId) : <span className="text-danger">Unassigned</span>}</td>
                    <td>{t.escalatedToId ? data.actorName(t.escalatedToId) : "—"}</td>
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