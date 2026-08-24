import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { isOverdue } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Avatar } from "../components/ui/Avatar";
import { formatCurrency, formatDate, timeAgo } from "../utils/format";

type Tab = "overview" | "tasks" | "materials" | "expenses" | "team" | "activity";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, showToast } = useApp();
  const data = useData();
  const [tab, setTab] = useState<Tab>("overview");

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  const project = id ? data.projectById(id) : undefined;

  /* Access: owner all; manager if they lead it; worker if assigned;
     developer/CS only when the project relates to their tickets. */
  const hasAccess = useMemo(() => {
    if (!project) return false;
    switch (role) {
      case "owner":
        return true;
      case "manager":
        return project.builderId === myId;
      case "worker":
        return project.workerIds.includes(myId);
      case "developer":
      case "customer-service": {
        const related = data.requests.some(
          (r) =>
            r.projectId === project.id &&
            (r.assignedToId === myId || r.escalatedToId === myId),
        );
        return related || project.builderId === myId;
      }
      default:
        return false;
    }
  }, [project, role, myId, data]);

  if (!project || !hasAccess) {
    return (
      <EmptyState
        icon="🔨"
        title="Project not found or not accessible"
        text="The project doesn't exist or your role doesn't have access to it."
        action={
          <Link to="/projects" className="btn btn--primary">
            Back to Projects
          </Link>
        }
      />
    );
  }

  const property = data.propertyById(project.propertyId);
  const projectTasks = data.tasks.filter((t) => t.projectId === project.id);
  const projectOrders = data.purchaseOrders.filter((o) => o.projectId === project.id);
  const projectExpenses = data.transactions.filter((t) => t.projectId === project.id && t.type === "expense");
  const projectActivity = data.activity.filter((a) => a.projectId === project.id);

  const canSeeFinances = role === "owner" || role === "manager";
  const remaining = project.budget - project.spent;

  return (
    <div>
      <div className="detail-header">
        <div className="detail-header__title">{project.name}</div>
        <div className="detail-header__meta">
          <span>{property?.name ?? "No property"}</span>
          <span>·</span>
          <StatusBadge status={project.status} />
          <span>·</span>
          <span>Builder: {data.actorName(project.builderId)}</span>
        </div>
        {canSeeFinances && (
          <div className="detail-header__actions">
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => {
                showToast("Use Edit on the Projects list to modify this project", "info");
              }}
            >
              Edit Project
            </button>
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        {(["overview", "tasks", "materials", ...(canSeeFinances ? (["expenses"] as Tab[]) : []), "team", "activity"] as Tab[]).map(
                  (t) => (
                    <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                      {t === "tasks" ? ` (${projectTasks.length})` : ""}
                      {t === "materials" ? ` (${projectOrders.length})` : ""}
                      {t === "expenses" ? ` (${projectExpenses.length})` : ""}
                    </button>
                  ),
                )}
      </div>

      {tab === "overview" && (
        <>
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Project Information</h2>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-item__label">Property</div>
                <div className="info-item__value">{property?.name ?? "—"}</div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Start Date</div>
                <div className="info-item__value">{formatDate(project.startDate)}</div>
              </div>
              <div className="info-item">
                <div className="info-item__label">{project.status === "completed" ? "Completed" : "Target Completion"}</div>
                <div className="info-item__value">
                  {(project.status === "completed" ? project.endDate : project.targetEndDate)
                    ? formatDate((project.status === "completed" ? project.endDate : project.targetEndDate)!)
                    : "—"}
                </div>
              </div>
              {canSeeFinances && (
                <>
                  <div className="info-item">
                    <div className="info-item__label">Budget</div>
                    <div className="info-item__value">{formatCurrency(project.budget)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-item__label">Spent</div>
                    <div className="info-item__value">{formatCurrency(project.spent)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-item__label">Remaining</div>
                    <div className="info-item__value">{formatCurrency(remaining)}</div>
                  </div>
                </>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <ProgressBar label="Progress" value={project.progress} tone={project.progress === 100 ? "success" : "primary"} />
            </div>
            {project.description && (
              <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--text-muted)" }}>{project.description}</p>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Open Tasks</h2>
              <Link to="/tasks" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {projectTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length === 0 ? (
              <EmptyState icon="📋" title="No open tasks" text="All tasks for this project are done or cancelled." />
            ) : (
              <ul className="activity-list">
                {projectTasks
                  .filter((t) => t.status !== "completed" && t.status !== "cancelled")
                  .slice(0, 6)
                  .map((task) => (
                    <li key={task.id} className="activity-item">
                      <span
                        className="activity-item__dot"
                        style={{
                          background:
                            task.priority === "urgent" || task.priority === "high"
                              ? "var(--danger)"
                              : task.priority === "normal"
                                ? "var(--warning)"
                                : "var(--text-subtle)",
                        }}
                      />
                      <div className="activity-item__content">
                        <div className="activity-item__text">{task.title}</div>
                        <div className="activity-item__time">
                          {task.status.replace("-", " ")} · Due {formatDate(task.dueDate)} ·{" "}
                          {data.actorName(task.assigneeId)}
                          {isOverdue(task) ? " · OVERDUE" : ""}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "tasks" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Tasks</h2>
            <Link to="/tasks" className="btn btn--ghost btn--sm">
              Manage in Tasks
            </Link>
          </div>
          {projectTasks.length === 0 ? (
            <EmptyState icon="📋" title="No tasks yet" text="Tasks will appear here as work is planned." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Progress</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 500 }}>{task.title}</td>
                      <td>
                        <StatusBadge status={task.status} />
                      </td>
                      <td>
                        <StatusBadge status={task.priority} />
                      </td>
                      <td>{data.actorName(task.assigneeId)}</td>
                      <td style={{ minWidth: 100 }}>
                        <ProgressBar value={task.progress} tone={task.progress === 100 ? "success" : "primary"} />
                      </td>
                      <td>{formatDate(task.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "materials" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Purchase Orders</h2>
            {canSeeFinances && (
              <Link to="/purchasing" className="btn btn--ghost btn--sm">
                Manage in Purchasing
              </Link>
            )}
          </div>
          {projectOrders.length === 0 ? (
            <EmptyState icon="🛒" title="No purchase orders" text="Material orders for this project will appear here." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    {canSeeFinances && <th>Total</th>}
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {projectOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id.toUpperCase()}</td>
                      <td>{order.supplier}</td>
                      <td>{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</td>
                      {canSeeFinances && <td>{formatCurrency(order.total)}</td>}
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>{formatDate(order.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {canSeeFinances && tab === "expenses" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Expenses</h2>
            {role === "owner" && (
              <Link to="/finance" className="btn btn--ghost btn--sm">
                Manage in Finance
              </Link>
            )}
          </div>
          {projectExpenses.length === 0 ? (
            <EmptyState icon="💰" title="No expenses recorded" text="Recorded expenses for this project will appear here." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {projectExpenses.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>{tx.description}</td>
                      <td>{tx.category}</td>
                      <td style={{ color: "var(--danger)" }}>−{formatCurrency(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {tab === "team" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Team</h2>
          </div>
          <ul className="team-list">
            {[data.personById(project.builderId), ...project.workerIds.map((wid) => data.personById(wid))]
              .filter((p): p is NonNullable<typeof p> => Boolean(p))
              .map((person, idx) => (
                <li key={`${person.id}-${idx}`} className="team-member">
                  <Avatar name={person.name} size={34} />
                  <div>
                    <strong>{person.name}</strong>
                    <small>
                      {person.title}
                      {person.kind === "worker" && person.specialty ? ` · ${person.specialty}` : ""}
                    </small>
                  </div>
                  <span className={`badge ${person.kind === "builder" ? "badge--info" : "badge--neutral"}`}>
                    {person.kind === "builder" ? "Builder" : "Worker"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {tab === "activity" && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Project Activity</h2>
          </div>
          {projectActivity.length === 0 ? (
            <EmptyState icon="📋" title="No activity recorded" text="Business events for this project will appear here." />
          ) : (
            <ul className="activity-list">
              {projectActivity.map((item) => (
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