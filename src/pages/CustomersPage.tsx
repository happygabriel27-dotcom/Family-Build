/* ============================================================
   FamilyBuild — Customers directory (Customer Service + Owner)
   ------------------------------------------------------------
   Property owners with their properties, open ticket counts,
   and quick actions to message them or view their tickets.
   ============================================================ */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { isOpenTicket } from "../data/calculations";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Avatar } from "../components/ui/Avatar";

export function CustomersPage() {
  const { user, showToast } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  if (!user) return null;

  const customers = useMemo(() => {
    return data.people
      .filter((p) => p.kind === "property-owner")
      .map((owner) => {
        const properties = data.properties.filter((pr) => pr.ownerId === owner.id);
        const propIds = new Set(properties.map((p) => p.id));
        const tickets = data.requests.filter(
          (r) => r.submittedById === owner.id || (r.propertyId && propIds.has(r.propertyId)),
        );
        const open = tickets.filter(isOpenTicket);
        const unreadMessages = data.conversations.filter(
          (c) =>
            c.participantIds.includes(owner.id) &&
            c.messages.some((m) => m.senderId === owner.id && !m.readBy.includes(user.personId)),
        ).length;
        return { owner, properties, tickets, openCount: open.length, unreadMessages };
      })
      .filter((row) =>
        search.trim() === ""
          ? true
          : row.owner.name.toLowerCase().includes(search.toLowerCase()) ||
            row.properties.some((p) => p.name.toLowerCase().includes(search.toLowerCase())),
      );
  }, [data.people, data.properties, data.requests, data.conversations, search, user.personId]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Customers</h1>
          <p className="page-header__subtitle">
            Property owners you support — their properties, open tickets, and conversations.
          </p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label="Search customers"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon="👥" title="No customers found" text="Property owners will appear here." />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Properties</th>
                  <th>Open Tickets</th>
                  <th>Total Tickets</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map(({ owner, properties, tickets, openCount }) => (
                  <tr key={owner.id}>
                    <td>
                      <span className="cell-person">
                        <Avatar name={owner.name} size={26} />
                        <span style={{ fontWeight: 500 }}>{owner.name}</span>
                      </span>
                    </td>
                    <td>
                      <small style={{ color: "var(--text-muted)" }}>
                        {owner.email}
                        <br />
                        {owner.phone}
                      </small>
                    </td>
                    <td>
                      {properties.length > 0
                        ? properties.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="btn btn--ghost btn--sm"
                              style={{ display: "block", padding: "2px 4px" }}
                              onClick={() => {
                                if (user.role === "owner") navigate(`/properties/${p.id}`);
                                else showToast("Only the Owner can open property records.", "info");
                              }}
                            >
                              {p.name}
                            </button>
                          ))
                        : "—"}
                    </td>
                    <td>
                      {openCount > 0 ? (
                        <strong style={{ color: "var(--danger)" }}>{openCount} open</strong>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td>{tickets.length}</td>
                    <td>
                      <StatusBadge status={owner.status} />
                    </td>
                    <td>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          showToast(`Open Messages and start a conversation with ${owner.name}.`, "info");
                          navigate("/messages");
                        }}
                      >
                        Message
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}