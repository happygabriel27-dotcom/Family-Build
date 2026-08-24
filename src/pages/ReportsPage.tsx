import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { financeTotals, isOpenTicket, lowStockItems } from "../data/calculations";
import { isOverdue } from "../data/types";
import { ProgressBar } from "../components/ui/ProgressBar";
import { formatCurrency } from "../utils/format";

/** Owner-only business analytics built live from the data layer. */
export function ReportsPage() {
  const { user } = useApp();
  const data = useData();

  if (!user || user.role !== "owner") return null;

  const stats = useMemo(() => {
    const activeProjects = data.projects.filter((p) => p.status === "in-progress");
    const completedProjects = data.projects.filter((p) => p.status === "completed");
    const overdueTasks = data.tasks.filter(isOverdue);
    const blockedTasks = data.tasks.filter((t) => t.status === "blocked");
    const openRequests = data.requests.filter(isOpenTicket);
    const pendingPOs = data.purchaseOrders.filter((o) => o.status === "pending");
    const lowStock = lowStockItems(data.inventory, data.inventoryTransactions);
    const totals = financeTotals(data.transactions);
    const portfolioValue = data.properties.reduce((s, p) => s + p.currentValue, 0);
    return {
      activeProjects,
      completedProjects,
      overdueTasks,
      blockedTasks,
      openRequests,
      pendingPOs,
      lowStock,
      totals,
      portfolioValue,
    };
  }, [data]);

  const workload = useMemo(() => {
    return data.people
      .filter((p) => p.kind === "worker" || p.kind === "builder")
      .map((person) => {
        const open = data.tasks.filter(
          (t) => t.assigneeId === person.id && t.status !== "completed" && t.status !== "cancelled",
        );
        return {
          person,
          open: open.length,
          overdue: open.filter(isOverdue).length,
        };
      })
      .sort((a, b) => b.open - a.open);
  }, [data.people, data.tasks]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Reports</h1>
          <p className="page-header__subtitle">
            Live business analytics across properties, projects, tasks, and finances.
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat__label">Portfolio Value</div>
          <div className="stat__value">{formatCurrency(stats.portfolioValue)}</div>
          <div className="stat__hint">{data.properties.length} properties</div>
        </div>
        <div className="stat">
          <div className="stat__label">Net (recorded)</div>
          <div className="stat__value">{formatCurrency(stats.totals.net)}</div>
          <div className="stat__hint">
            {formatCurrency(stats.totals.income)} in · {formatCurrency(stats.totals.expenses)} out
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Active Projects</div>
          <div className="stat__value">{stats.activeProjects.length}</div>
          <div className="stat__hint">{stats.completedProjects.length} completed</div>
        </div>
        <div className="stat">
          <div className="stat__label">Attention Needed</div>
          <div className="stat__value" style={{ color: stats.overdueTasks.length > 0 ? "var(--danger)" : undefined }}>
            {stats.overdueTasks.length + stats.blockedTasks.length}
          </div>
          <div className="stat__hint">
            {stats.overdueTasks.length} overdue · {stats.blockedTasks.length} blocked
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Project Progress</h2>
              <p className="card__subtitle">Budget usage and completion per active project</p>
            </div>
          </div>
          {stats.activeProjects.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No active projects.</p>
          ) : (
            <ul className="report-list">
              {stats.activeProjects.map((project) => {
                const budgetUsed = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0;
                return (
                  <li key={project.id}>
                    <div className="report-list__head">
                      <Link to={`/projects/${project.id}`}>{project.name}</Link>
                      <span>
                        {formatCurrency(project.spent)} / {formatCurrency(project.budget)} ({budgetUsed}%)
                      </span>
                    </div>
                    <ProgressBar value={project.progress} label="Completion" tone={project.progress === 100 ? "success" : "primary"} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Team Workload</h2>
              <p className="card__subtitle">Open tasks per builder and worker</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Open Tasks</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((row) => (
                  <tr key={row.person.id}>
                    <td style={{ fontWeight: 500 }}>{row.person.name}</td>
                    <td>{row.person.kind}</td>
                    <td>{row.open}</td>
                    <td style={{ color: row.overdue > 0 ? "var(--danger)" : undefined }}>{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Open Client Requests</h2>
          </div>
          {stats.openRequests.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing open — all clear.</p>
          ) : (
            <ul className="activity-list">
              {stats.openRequests.map((r) => (
                <li key={r.id} className="activity-item">
                  <span className="activity-item__dot" style={{ background: r.kind === "problem" ? "var(--danger)" : "var(--info)" }} />
                  <div className="activity-item__content">
                    <div className="activity-item__text">{r.title}</div>
                    <div className="activity-item__time">
                      {data.propertyById(r.propertyId)?.name} · {r.status.replace("-", " ")} · by {data.actorName(r.submittedById)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Operational Flags</h2>
          </div>
          <ul className="activity-list">
            <li className="activity-item">
              <span className="activity-item__dot" style={{ background: stats.pendingPOs.length > 0 ? "var(--warning)" : "var(--text-subtle)" }} />
              <div className="activity-item__content">
                <div className="activity-item__text">{stats.pendingPOs.length} purchase request(s) awaiting approval</div>
                <div className="activity-item__time">Review in Purchasing</div>
              </div>
            </li>
            <li className="activity-item">
              <span className="activity-item__dot" style={{ background: stats.lowStock.length > 0 ? "var(--danger)" : "var(--text-subtle)" }} />
              <div className="activity-item__content">
                <div className="activity-item__text">{stats.lowStock.length} inventory item(s) at or below minimum</div>
                <div className="activity-item__time">Check Inventory</div>
              </div>
            </li>
            <li className="activity-item">
              <span className="activity-item__dot" style={{ background: "var(--info)" }} />
              <div className="activity-item__content">
                <div className="activity-item__text">
                  {data.transactions.filter((t) => t.status === "cancelled").length} cancelled transaction(s) excluded from totals
                </div>
                <div className="activity-item__time">Audit trail kept in Finance</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}