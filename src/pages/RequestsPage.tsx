/* ============================================================
   FamilyBuild — Requests & Problems (client tickets)
   ------------------------------------------------------------
   Client submissions become support tickets (#number) that
   Customer Service receives in the Support Inbox. Owner/Manager
   review them here; workflow actions live in the shared
   TicketDetailModal.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { isOpenTicket } from "../data/calculations";
import type { RequestKind, RequestStatus } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TicketDetailModal } from "../components/support/TicketDetailModal";
import { formatDate, timeAgo } from "../utils/format";

const REQUEST_STATUSES: RequestStatus[] = [
  "submitted",
  "under-review",
  "assigned",
  "in-progress",
  "waiting",
  "resolved",
  "closed",
];

export function RequestsPage({ kind }: { kind: RequestKind }) {
  const { user } = useApp();
  const data = useData();

  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!user) return null;

  const visibleRequests = useMemo(
    () =>
      data.requests
        .filter((r) => r.kind === kind)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.requests, kind],
  );

  const filtered = visibleRequests.filter(
    (r) => statusFilter === "all" || r.status === statusFilter,
  );

  const openCount = visibleRequests.filter(isOpenTicket).length;

  const detail = detailId ? data.requests.find((r) => r.id === detailId) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{kind === "problem" ? "Problems" : "Requests"}</h1>
          <p className="page-header__subtitle">
            {kind === "problem"
              ? "Client-reported problems tracked from submission to resolution."
              : "Client requests reviewed by the team. Customer Service keeps submitters updated."}
          </p>
        </div>
        <div className="page-header__actions">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="toolbar-select"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("-", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat__label">Total</div>
          <div className="stat__value">{visibleRequests.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Open</div>
          <div className="stat__value">{openCount}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Resolved</div>
          <div className="stat__value">
            {visibleRequests.filter((r) => r.status === "resolved" || r.status === "closed").length}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={kind === "problem" ? "🔧" : "📝"}
          title={
            visibleRequests.length === 0
              ? `No ${kind === "problem" ? "problems reported" : "requests submitted"} yet`
              : "No matches"
          }
          text={
            visibleRequests.length === 0
              ? "Client submissions will appear here."
              : "Try a different status filter."
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Property</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Submitted</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((request) => {
                  const property = data.propertyById(request.propertyId);
                  return (
                    <tr key={request.id}>
                      <td style={{ fontWeight: 500 }}>
                        <span className="ticket-number">#{request.ticketNo}</span> {request.title}
                      </td>
                      <td>{property?.name ?? "—"}</td>
                      <td>{request.category}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                      <td>
                        <StatusBadge status={request.priority} />
                      </td>
                      <td>{request.assignedToId ? data.actorName(request.assignedToId) : "—"}</td>
                      <td>{formatDate(request.createdAt.slice(0, 10))}</td>
                      <td>{timeAgo(request.updatedAt)}</td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => setDetailId(request.id)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <TicketDetailModal request={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}