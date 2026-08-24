import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { formatCurrency, formatDate, timeAgo } from "../utils/format";

type Tab = "overview" | "projects" | "requests" | "activity";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, showToast } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  const property = id ? data.propertyById(id) : undefined;

  /* Access check: owner sees all; manager only properties of their projects. */
  const hasAccess = useMemo(() => {
    if (!property) return false;
    if (role === "owner") return true;
    if (role === "manager") {
      return data.projects.some((p) => p.propertyId === property.id && p.builderId === myId);
    }
    return false;
  }, [property, role, data.projects, myId]);

  if (!property || !hasAccess) {
    return (
      <EmptyState
        icon="🏠"
        title="Property not found or not accessible"
        text="The property doesn't exist or your role doesn't have access to it."
        action={
          <Link to="/properties" className="btn btn--primary">
            Back to Properties
          </Link>
        }
      />
    );
  }

  const owner = data.personById(property.ownerId);
  const propertyProjects = data.projects.filter((p) => p.propertyId === property.id);
  const propertyRequests = data.requests.filter((r) => r.propertyId === property.id);
  const propertyActivity = data.activity.filter((a) => a.propertyId === property.id);

  const netMonthly = property.monthlyIncome - property.monthlyExpenses;

  return (
    <div>
      <div className="detail-header">
        <div className="detail-header__title">{property.name}</div>
        <div className="detail-header__meta">
          <span>{property.address}</span>
          <span>·</span>
          <span>{property.type}</span>
          <span>·</span>
          <StatusBadge status={property.status} />
        </div>
        {role === "owner" && (
          <div className="detail-header__actions">
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => {
                showToast("Use Edit on the Properties list to modify this property", "info");
                navigate("/properties");
              }}
            >
              Edit Property
            </button>
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        {(["overview", "projects", "requests", "activity"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "projects" ? ` (${propertyProjects.length})` : ""}
            {t === "requests" ? ` (${propertyRequests.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Property Information</h2>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-item__label">Owner</div>
                <div className="info-item__value">{owner?.name ?? "—"}</div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Acquired</div>
                <div className="info-item__value">{formatDate(property.acquiredDate)}</div>
              </div>
              {role === "owner" && (
                <>
                  <div className="info-item">
                    <div className="info-item__label">Purchase Cost</div>
                    <div className="info-item__value">{formatCurrency(property.purchaseCost)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-item__label">Current Value</div>
                    <div className="info-item__value">{formatCurrency(property.currentValue)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-item__label">Monthly Income</div>
                    <div className="info-item__value">{formatCurrency(property.monthlyIncome)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-item__label">Monthly Expenses</div>
                    <div className="info-item__value">{formatCurrency(property.monthlyExpenses)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-item__label">Net Monthly</div>
                    <div className="info-item__value">{formatCurrency(netMonthly)}</div>
                  </div>
                </>
              )}
            </div>
            {property.description && (
              <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--text-muted)" }}>{property.description}</p>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Open Issues & Requests</h2>
            </div>
            {propertyRequests.filter((r) => !["resolved", "closed"].includes(r.status)).length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing open — all clear.</p>
            ) : (
              <ul className="activity-list">
                {propertyRequests
                  .filter((r) => !["resolved", "closed"].includes(r.status))
                  .map((r) => (
                    <li key={r.id} className="activity-item">
                      <span className="activity-item__dot" style={{ background: r.kind === "problem" ? "var(--danger)" : "var(--info)" }} />
                      <div className="activity-item__content">
                        <div className="activity-item__text">{r.title}</div>
                        <div className="activity-item__time">
                          {r.kind} · {r.status.replace("-", " ")} · by {data.actorName(r.submittedById)}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "projects" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Projects</h2>
          </div>
          {propertyProjects.length === 0 ? (
            <EmptyState icon="🔨" title="No projects yet" text="Projects on this property will appear here." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th style={{ minWidth: 140 }}>Progress</th>
                    <th>Builder</th>
                    {role === "owner" && <th>Budget</th>}
                  </tr>
                </thead>
                <tbody>
                  {propertyProjects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projects/${project.id}`}>{project.name}</Link>
                      </td>
                      <td>
                        <StatusBadge status={project.status} />
                      </td>
                      <td>
                        <ProgressBar value={project.progress} tone={project.progress === 100 ? "success" : "primary"} />
                      </td>
                      <td>{data.actorName(project.builderId)}</td>
                      {role === "owner" && <td>{formatCurrency(project.budget)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Requests & Problems</h2>
          </div>
          {propertyRequests.length === 0 ? (
            <EmptyState icon="🔧" title="No requests yet" text="Client submissions for this property will appear here." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Kind</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Submitted</th>
                    <th>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyRequests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td>{r.kind}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <StatusBadge status={r.priority} />
                      </td>
                      <td>{timeAgo(r.createdAt)}</td>
                      <td>{r.assignedToId ? data.actorName(r.assignedToId) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {tab === "activity" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Property Activity</h2>
          </div>
          {propertyActivity.length === 0 ? (
            <EmptyState icon="📋" title="No activity recorded" text="Business events for this property will appear here." />
          ) : (
            <ul className="activity-list">
              {propertyActivity.map((item) => (
                <li key={item.id} className="activity-item">
                  <span
                    className="activity-item__dot"
                    style={{
                      background:
                        item.color === "success"
                          ? "var(--success)"
                          : item.color === "warning"
                            ? "var(--warning)"
                            : item.color === "danger"
                              ? "var(--danger)"
                              : item.color === "info"
                                ? "var(--info)"
                                : "var(--text-subtle)",
                    }}
                  />
                  <div className="activity-item__content">
                    <div className="activity-item__text">{item.text}</div>
                    <div className="activity-item__time">{timeAgo(item.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}