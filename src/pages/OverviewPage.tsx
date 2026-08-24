/* ============================================================
   FamilyBuild — Role Dashboards
   ------------------------------------------------------------
   Every number is derived from live application state via
   data/calculations.ts — nothing hard-coded:
   Owner / Manager / Developer / Worker / Customer Service each
   get a focused overview.
   ============================================================ */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import {
  announcementsForRole,
  financeTotals,
  isOpenTicket,
  lowStockItems,
  openTickets,
  pendingPurchaseOrders,
  ticketsAssignedTo,
  ticketsEscalatedTo,
  unreadNotifications,
} from "../data/calculations";
import { isOverdue } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { formatCurrency, formatDate, timeAgo } from "../utils/format";

const DOT_COLORS: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--text-subtle)",
};

export function OverviewPage() {
  const { user } = useApp();
  const data = useData();

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  /* ---------- shared scoped data ---------- */
  const scoped = useMemo(() => {
    let properties = data.properties;
    let projects = data.projects;
    let tasks = data.tasks;
    let requests = data.requests;

    if (role === "manager") {
      projects = data.projects.filter((p) => p.builderId === myId);
      const propIds = new Set(projects.map((p) => p.propertyId));
      properties = data.properties.filter((p) => propIds.has(p.id));
      tasks = data.tasks.filter((t) => projects.some((pr) => pr.id === t.projectId));
      requests = data.requests.filter((r) => propIds.has(r.propertyId));
    } else if (role === "developer") {
      tasks = data.tasks.filter((t) => t.isTechnical && t.assigneeId === myId);
      requests = data.requests.filter(
        (r) => r.escalatedToId === myId || r.assignedToId === myId,
      );
      projects = [];
      properties = [];
    } else if (role === "worker") {
      tasks = data.tasks.filter((t) => t.assigneeId === myId);
      const projectIds = new Set(tasks.map((t) => t.projectId));
      projects = data.projects.filter((p) => projectIds.has(p.id) || p.workerIds.includes(myId));
      const propIds = new Set(projects.map((p) => p.propertyId));
      properties = data.properties.filter((p) => propIds.has(p.id));
      requests = [];
    } else if (role === "customer-service") {
      /* Support queue plus only the work relevant to this agent:
         their own tasks and projects tied to their assigned tickets. */
      requests = data.requests;
      tasks = data.tasks.filter((t) => t.assigneeId === myId);
      const ticketPropIds = new Set(
        data.requests
          .filter((r) => r.assignedToId === myId || r.escalatedToId === myId)
          .map((r) => r.propertyId),
      );
      projects = data.projects.filter((p) => ticketPropIds.has(p.propertyId));
      properties = [];
    }
    return { properties, projects, tasks, requests };
  }, [data, role, myId]);

  const activityForRole = useMemo(() => {
    if (role === "owner") return data.activity.slice(0, 6);
    if (role === "worker") {
      const projectIds = new Set(scoped.projects.map((p) => p.id));
      return data.activity.filter((a) => a.projectId && projectIds.has(a.projectId)).slice(0, 6);
    }
    if (role === "developer" || role === "customer-service") return data.activity.slice(0, 6);
    const projectIds = new Set(scoped.projects.map((p) => p.id));
    return data.activity.filter((a) => !a.projectId || projectIds.has(a.projectId)).slice(0, 6);
  }, [data.activity, role, scoped]);

  const recentAnnouncements = useMemo(
    () => announcementsForRole(data.announcements, role).slice(0, 3),
    [data.announcements, role],
  );

  const greeting =
    role === "owner"
      ? "Portfolio overview"
      : role === "manager"
        ? "Your active sites"
        : role === "developer"
          ? "Technical work at a glance"
          : role === "worker"
            ? "Your work at a glance"
            : role === "customer-service"
              ? "Support queue at a glance"
              : "Welcome back";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Dashboard</h1>
          <p className="page-header__subtitle">{greeting} — everything that needs your attention today.</p>
        </div>
        <div className="page-header__actions">
          {role === "owner" && (
            <Link to="/projects" className="btn btn--primary">
              + New Project
            </Link>
          )}
          {role === "customer-service" && (
            <Link to="/support" className="btn btn--primary">
              Open Support Inbox
            </Link>
          )}
          {role === "worker" && (
            <Link to="/tasks" className="btn btn--primary">
              Open My Tasks
            </Link>
          )}
        </div>
      </div>

      {/* ================= ROLE DASHBOARDS ================= */}
      {role === "owner" && <OwnerDashboard />}
      {role === "manager" && <ManagerDashboard />}
      {role === "developer" && <DeveloperDashboard />}
      {role === "worker" && <WorkerDashboard />}
      {role === "customer-service" && <CustomerServiceDashboard />}
    </div>
  );

  /* ---------- shared small components ---------- */

  function ActivityList({ items }: { items: typeof data.activity }) {
    if (items.length === 0) {
      return <EmptyState icon="📋" title="No activity yet" text="Business events will appear here." />;
    }
    return (
      <ul className="activity-list">
        {items.map((item) => (
          <li key={item.id} className="activity-item">
            <span className="activity-item__dot" style={{ background: DOT_COLORS[item.color] }} />
            <div className="activity-item__content">
              <div className="activity-item__text">{item.text}</div>
              <div className="activity-item__time">{timeAgo(item.createdAt)}</div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function AnnouncementsCard() {
    if (recentAnnouncements.length === 0) return null;
    return (
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Announcements</h2>
          <Link to="/announcements" className="btn btn--ghost btn--sm">
            View all
          </Link>
        </div>
        <ul className="activity-list">
          {recentAnnouncements.map((a) => (
            <li key={a.id} className="activity-item">
              <span className="activity-item__dot" style={{ background: "var(--info)" }} />
              <div className="activity-item__content">
                <div className="activity-item__text">{a.title}</div>
                <div className="activity-item__time">{timeAgo(a.publishedAt ?? a.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ---------- Owner ---------- */
  function OwnerDashboard() {
    const activeProjects = scoped.projects.filter((p) => p.status === "in-progress");
    const pendingApprovals = pendingPurchaseOrders(data.purchaseOrders);
    const openIssues = scoped.requests.filter(isOpenTicket);
    const overdueTasks = scoped.tasks.filter(isOverdue);
    const lowStock = lowStockItems(data.inventory, data.inventoryTransactions);
    const totals = financeTotals(data.transactions);

    return (
      <>
        <div className="stats-row">
          <div className="stat">
            <div className="stat__label">Properties</div>
            <div className="stat__value">{scoped.properties.filter((p) => p.status === "active").length}</div>
            <div className="stat__hint">{scoped.properties.length} total</div>
          </div>
          <div className="stat">
            <div className="stat__label">Active Projects</div>
            <div className="stat__value">{activeProjects.length}</div>
            <div className="stat__hint">{scoped.projects.length} total</div>
          </div>
          <div className="stat">
            <div className="stat__label">Pending Approvals</div>
            <div className="stat__value" style={{ color: pendingApprovals.length > 0 ? "var(--warning)" : undefined }}>
              {pendingApprovals.length}
            </div>
            <div className="stat__hint">Purchase requests</div>
          </div>
          <div className="stat">
            <div className="stat__label">Open Issues</div>
            <div className="stat__value" style={{ color: openIssues.length > 0 ? "var(--danger)" : undefined }}>
              {openIssues.length}
            </div>
            <div className="stat__hint">{overdueTasks.length} overdue tasks</div>
          </div>
          <div className="stat">
            <div className="stat__label">Net (recorded)</div>
            <div className="stat__value">{formatCurrency(totals.net)}</div>
            <div className="stat__hint">
              {formatCurrency(totals.income)} in · {formatCurrency(totals.expenses)} out
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Active Projects</h2>
                <p className="card__subtitle">Current construction and renovation work</p>
              </div>
              <Link to="/projects" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {activeProjects.length === 0 ? (
              <EmptyState icon="🔨" title="No active projects" text="Start a project to see it here." />
            ) : (
              <ul className="report-list">
                {activeProjects.slice(0, 4).map((project) => (
                  <li key={project.id}>
                    <div className="report-list__head">
                      <Link to={`/projects/${project.id}`}>{project.name}</Link>
                      <span>{formatDate(project.targetEndDate ?? "")}</span>
                    </div>
                    <ProgressBar value={project.progress} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Needs Attention</h2>
            </div>
            {[...openIssues.slice(0, 3), ...pendingApprovals.slice(0, 2)].length === 0 ? (
              <EmptyState icon="✅" title="All clear" text="No open issues or approvals." />
            ) : (
              <ul className="activity-list">
                {openIssues.slice(0, 3).map((r) => (
                  <li key={r.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: r.kind === "problem" ? "var(--danger)" : "var(--info)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">#{r.ticketNo} {r.title}</div>
                      <div className="activity-item__time">
                        {data.propertyById(r.propertyId)?.name} · {r.status.replace("-", " ")}
                      </div>
                    </div>
                  </li>
                ))}
                {pendingApprovals.slice(0, 2).map((po) => (
                  <li key={po.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--warning)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">
                        Purchase request: {po.supplier} ({formatCurrency(po.total)})
                      </div>
                      <div className="activity-item__time">Awaiting your approval · Purchasing</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Recent Activity</h2>
            </div>
            <ActivityList items={activityForRole} />
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Upcoming & Overdue Tasks</h2>
                <p className="card__subtitle">Across all projects</p>
              </div>
              <Link to="/tasks" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {scoped.tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length === 0 ? (
              <EmptyState icon="📋" title="No open tasks" text="Everything is done." />
            ) : (
              <ul className="activity-list">
                {scoped.tasks
                  .filter((t) => t.status !== "completed" && t.status !== "cancelled")
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0, 6)
                  .map((task) => (
                    <li key={task.id} className="activity-item">
                      <span
                        className="activity-item__dot"
                        style={{
                          background: isOverdue(task)
                            ? "var(--danger)"
                            : task.priority === "high" || task.priority === "urgent"
                              ? "var(--warning)"
                              : "var(--text-subtle)",
                        }}
                      />
                      <div className="activity-item__content">
                        <div className="activity-item__text">{task.title}</div>
                        <div className="activity-item__time">
                          Due {formatDate(task.dueDate)} · {data.actorName(task.assigneeId)}
                          {isOverdue(task) ? " · OVERDUE" : ""}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Inventory Warnings</h2>
                <p className="card__subtitle">Items at or below minimum stock</p>
              </div>
              <Link to="/inventory" className="btn btn--ghost btn--sm">
                Inventory
              </Link>
            </div>
            {lowStock.length === 0 ? (
              <EmptyState icon="📦" title="Stock levels healthy" text="Nothing below minimum." />
            ) : (
              <ul className="activity-list">
                {lowStock.slice(0, 5).map(({ item, level, status }) => (
                  <li key={item.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: status === "out-of-stock" ? "var(--danger)" : "var(--warning)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{item.name}</div>
                      <div className="activity-item__time">
                        {level.current} {item.unit} on hand · minimum {item.minStock}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AnnouncementsCard />
        </div>
      </>
    );
  }

  /* ---------- Manager ---------- */
  function ManagerDashboard() {
    const activeProjects = scoped.projects.filter((p) => p.status === "in-progress");
    const overdueTasks = scoped.tasks.filter(isOverdue);
    const blockedTasks = scoped.tasks.filter((t) => t.status === "blocked");
    const lowStock = lowStockItems(data.inventory, data.inventoryTransactions);

    return (
      <>
        <div className="stats-row">
          <div className="stat">
            <div className="stat__label">Active Projects</div>
            <div className="stat__value">{activeProjects.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Open Tasks</div>
            <div className="stat__value">
              {scoped.tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Overdue</div>
            <div className="stat__value" style={{ color: overdueTasks.length > 0 ? "var(--danger)" : undefined }}>
              {overdueTasks.length}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Blocked</div>
            <div className="stat__value" style={{ color: blockedTasks.length > 0 ? "var(--warning)" : undefined }}>
              {blockedTasks.length}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Low Stock Items</div>
            <div className="stat__value" style={{ color: lowStock.length > 0 ? "var(--warning)" : undefined }}>
              {lowStock.length}
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">My Projects</h2>
                <p className="card__subtitle">Progress across your sites</p>
              </div>
              <Link to="/projects" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {activeProjects.length === 0 ? (
              <EmptyState icon="🔨" title="No active projects" text="Projects assigned to you appear here." />
            ) : (
              <ul className="report-list">
                {activeProjects.map((project) => (
                  <li key={project.id}>
                    <div className="report-list__head">
                      <Link to={`/projects/${project.id}`}>{project.name}</Link>
                      <StatusBadge status={project.status} />
                    </div>
                    <ProgressBar value={project.progress} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Worker Workload</h2>
                <p className="card__subtitle">Open tasks per crew member</p>
              </div>
              <Link to="/people/workers" className="btn btn--ghost btn--sm">
                Workers
              </Link>
            </div>
            <ul className="activity-list">
              {data.people
                .filter((p) => p.kind === "worker")
                .map((worker) => {
                  const open = scoped.tasks.filter(
                    (t) => t.assigneeId === worker.id && t.status !== "completed" && t.status !== "cancelled",
                  ).length;
                  return (
                    <li key={worker.id} className="activity-item">
                      <span className="activity-item__dot" style={{ background: open > 3 ? "var(--warning)" : "var(--info)" }} />
                      <div className="activity-item__content">
                        <div className="activity-item__text">{worker.name}</div>
                        <div className="activity-item__time">{open} open task{open === 1 ? "" : "s"}</div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Overdue & Blocked Tasks</h2>
                <p className="card__subtitle">Fix these first</p>
              </div>
              <Link to="/tasks" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {overdueTasks.length + blockedTasks.length === 0 ? (
              <EmptyState icon="✅" title="Nothing overdue" text="All tasks are on schedule." />
            ) : (
              <ul className="activity-list">
                {[...overdueTasks, ...blockedTasks].slice(0, 6).map((task) => (
                  <li key={task.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: isOverdue(task) ? "var(--danger)" : "var(--warning)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{task.title}</div>
                      <div className="activity-item__time">
                        {isOverdue(task) ? `Overdue since ${formatDate(task.dueDate)}` : "Blocked"} ·{" "}
                        {data.actorName(task.assigneeId)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Recent Activity</h2>
            </div>
            <ActivityList items={activityForRole} />
          </div>
        </div>
      </>
    );
  }

  /* ---------- Developer ---------- */
  function DeveloperDashboard() {
    const myTechTasks = scoped.tasks;
    const openTech = myTechTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
    const blocked = myTechTasks.filter((t) => t.status === "blocked");
    const escalatedTickets = ticketsEscalatedTo(data.requests, myId);
    const assignedTickets = ticketsAssignedTo(data.requests, myId);
    const myUnreadNtf = unreadNotifications(data.notifications, myId);

    return (
      <>
        <div className="stats-row">
          <div className="stat">
            <div className="stat__label">My Technical Tasks</div>
            <div className="stat__value">{openTech.length}</div>
            <div className="stat__hint">{myTechTasks.length} total assigned</div>
          </div>
          <div className="stat">
            <div className="stat__label">Overdue / Blocked</div>
            <div className="stat__value" style={{ color: blocked.length + myTechTasks.filter(isOverdue).length > 0 ? "var(--danger)" : undefined }}>
              {blocked.length + myTechTasks.filter(isOverdue).length}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Escalated Tickets</div>
            <div className="stat__value" style={{ color: escalatedTickets.length > 0 ? "var(--warning)" : undefined }}>
              {escalatedTickets.length}
            </div>
            <div className="stat__hint">Need technical attention</div>
          </div>
          <div className="stat">
            <div className="stat__label">Assigned Tickets</div>
            <div className="stat__value">{assignedTickets.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Unread Notifications</div>
            <div className="stat__value" style={{ color: myUnreadNtf.length > 0 ? "var(--primary)" : undefined }}>
              {myUnreadNtf.length}
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">My Technical Tasks</h2>
                <p className="card__subtitle">System & platform work assigned to you</p>
              </div>
              <Link to="/tasks" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {openTech.length === 0 ? (
              <EmptyState icon="🛠️" title="No open technical tasks" text="New assignments will appear here." />
            ) : (
              <ul className="report-list">
                {openTech.slice(0, 4).map((task) => (
                  <li key={task.id}>
                    <div className="report-list__head">
                      <span>{task.title}</span>
                      <StatusBadge status={task.status} />
                    </div>
                    <ProgressBar value={task.progress} tone={task.progress === 100 ? "success" : "primary"} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Customer Issues Needing Technical Attention</h2>
                <p className="card__subtitle">Escalated or assigned to you</p>
              </div>
              <Link to="/my-tickets" className="btn btn--ghost btn--sm">
                My tickets
              </Link>
            </div>
            {escalatedTickets.length + assignedTickets.length === 0 ? (
              <EmptyState icon="🎫" title="No tickets with you" text="Escalations will appear here." />
            ) : (
              <ul className="activity-list">
                {[...escalatedTickets, ...assignedTickets]
                  .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
                  .slice(0, 5)
                  .map((t) => (
                    <li key={t.id} className="activity-item">
                      <span className="activity-item__dot" style={{ background: t.kind === "problem" ? "var(--danger)" : "var(--info)" }} />
                      <div className="activity-item__content">
                        <div className="activity-item__text">#{t.ticketNo} {t.title}</div>
                        <div className="activity-item__time">
                          {t.escalatedToId === myId ? `Escalated: ${t.escalationReason ?? ""}` : "Assigned to you"} ·{" "}
                          {t.status.replace("-", " ")}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Recent Activity</h2>
            </div>
            <ActivityList items={activityForRole} />
          </div>

          <AnnouncementsCard />
        </div>
      </>
    );
  }

  /* ---------- Worker ---------- */
  function WorkerDashboard() {
    const today = new Date().toISOString().slice(0, 10);
    const todaysTasks = scoped.tasks.filter(
      (t) =>
        t.dueDate <= today &&
        t.status !== "completed" &&
        t.status !== "cancelled",
    );
    const upcoming = scoped.tasks
      .filter((t) => t.dueDate > today && t.status !== "completed" && t.status !== "cancelled")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const lowStock = lowStockItems(data.inventory, data.inventoryTransactions);
    const myUnreadNtf = unreadNotifications(data.notifications, myId);

    return (
      <>
        <div className="stats-row">
          <div className="stat">
            <div className="stat__label">Due / Overdue Today</div>
            <div className="stat__value" style={{ color: todaysTasks.length > 0 ? "var(--warning)" : undefined }}>
              {todaysTasks.length}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Upcoming</div>
            <div className="stat__value">{upcoming.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Completed</div>
            <div className="stat__value">{scoped.tasks.filter((t) => t.status === "completed").length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">My Projects</div>
            <div className="stat__value">{scoped.projects.length}</div>
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Today's Tasks</h2>
                <p className="card__subtitle">Due today or earlier</p>
              </div>
              <Link to="/tasks" className="btn btn--ghost btn--sm">
                All tasks
              </Link>
            </div>
            {todaysTasks.length === 0 ? (
              <EmptyState icon="🌤️" title="Nothing due today" text="Enjoy the clear board." />
            ) : (
              <ul className="activity-list">
                {todaysTasks.map((task) => (
                  <li key={task.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: isOverdue(task) ? "var(--danger)" : "var(--warning)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{task.title}</div>
                      <div className="activity-item__time">
                        Due {formatDate(task.dueDate)} · {task.progress}% done
                        {isOverdue(task) ? " · OVERDUE" : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Upcoming Tasks</h2>
                <p className="card__subtitle">Next on your list</p>
              </div>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState icon="📋" title="No upcoming tasks" text="New assignments will appear here." />
            ) : (
              <ul className="activity-list">
                {upcoming.slice(0, 5).map((task) => (
                  <li key={task.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--info)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{task.title}</div>
                      <div className="activity-item__time">Due {formatDate(task.dueDate)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">My Projects</h2>
                <p className="card__subtitle">Where you're assigned</p>
              </div>
              <Link to="/projects" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {scoped.projects.length === 0 ? (
              <EmptyState icon="🔨" title="Not assigned to any project yet" text="Your manager will assign you soon." />
            ) : (
              <ul className="report-list">
                {scoped.projects.map((project) => (
                  <li key={project.id}>
                    <div className="report-list__head">
                      <Link to={`/projects/${project.id}`}>{project.name}</Link>
                      <StatusBadge status={project.status} />
                    </div>
                    <ProgressBar value={project.progress} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Materials & Alerts</h2>
                <p className="card__subtitle">Warehouse stock and your notifications</p>
              </div>
              <Link to="/materials" className="btn btn--ghost btn--sm">
                Materials
              </Link>
            </div>
            {lowStock.length === 0 && myUnreadNtf.length === 0 ? (
              <EmptyState icon="✅" title="All clear" text="No stock warnings or unread alerts." />
            ) : (
              <ul className="activity-list">
                {lowStock.slice(0, 3).map(({ item, level, status }) => (
                  <li key={item.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: status === "out-of-stock" ? "var(--danger)" : "var(--warning)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{item.name}</div>
                      <div className="activity-item__time">
                        {level.current} {item.unit} left · minimum {item.minStock}
                      </div>
                    </div>
                  </li>
                ))}
                {myUnreadNtf.slice(0, 3).map((n) => (
                  <li key={n.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--primary)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{n.title}</div>
                      <div className="activity-item__time">{n.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ---------- Customer Service ---------- */
  function CustomerServiceDashboard() {
    const open = openTickets(data.requests);
    const unassigned = open.filter((t) => !t.assignedToId);
    const mine = ticketsAssignedTo(data.requests, myId);
    const highPriority = open.filter((t) => t.priority === "high" || t.priority === "urgent");
    const waiting = open.filter((t) => t.status === "waiting");
    const escalated = open.filter((t) => t.escalatedToId);
    const recentlyResolved = data.requests
      .filter((t) => t.status === "resolved" || t.status === "closed")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
    const myUnreadNtf = unreadNotifications(data.notifications, myId);
    const myOpenTasks = scoped.tasks.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled",
    );

    return (
      <>
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
            <div className="stat__label">Mine</div>
            <div className="stat__value">{mine.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">High Priority</div>
            <div className="stat__value" style={{ color: highPriority.length > 0 ? "var(--danger)" : undefined }}>
              {highPriority.length}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Waiting</div>
            <div className="stat__value">{waiting.length}</div>
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Needs Action</h2>
                <p className="card__subtitle">Unassigned and high-priority tickets</p>
              </div>
              <Link to="/support" className="btn btn--ghost btn--sm">
                Support Inbox
              </Link>
            </div>
            {unassigned.length + highPriority.length === 0 ? (
              <EmptyState icon="✅" title="Queue is clear" text="No unassigned or urgent tickets." />
            ) : (
              <ul className="activity-list">
                {unassigned.slice(0, 4).map((t) => (
                  <li key={t.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--danger)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">#{t.ticketNo} {t.title}</div>
                      <div className="activity-item__time">
                        Unassigned · {data.actorName(t.submittedById)} · {timeAgo(t.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
                {highPriority
                  .filter((t) => t.assignedToId)
                  .slice(0, 3)
                  .map((t) => (
                    <li key={t.id} className="activity-item">
                      <span className="activity-item__dot" style={{ background: "var(--warning)" }} />
                      <div className="activity-item__content">
                        <div className="activity-item__text">#{t.ticketNo} {t.title}</div>
                        <div className="activity-item__time">
                          High priority · with {t.assignedToId ? data.actorName(t.assignedToId) : "—"}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Recently Resolved</h2>
                <p className="card__subtitle">Latest closed-out tickets</p>
              </div>
            </div>
            {recentlyResolved.length === 0 ? (
              <EmptyState icon="🎫" title="Nothing resolved yet" text="Resolved tickets appear here." />
            ) : (
              <ul className="activity-list">
                {recentlyResolved.map((t) => (
                  <li key={t.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--success)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">#{t.ticketNo} {t.title}</div>
                      <div className="activity-item__time">
                        {t.status} · updated {timeAgo(t.updatedAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">My Tasks</h2>
                <p className="card__subtitle">Follow-ups and work assigned to you</p>
              </div>
              <Link to="/tasks" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {myOpenTasks.length === 0 ? (
              <EmptyState icon="📋" title="No assigned tasks" text="Managers can assign follow-up work here." />
            ) : (
              <ul className="activity-list">
                {[...myOpenTasks]
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0, 4)
                  .map((task) => (
                    <li key={task.id} className="activity-item">
                      <span
                        className="activity-item__dot"
                        style={{
                          background: isOverdue(task)
                            ? "var(--danger)"
                            : task.priority === "high" || task.priority === "urgent"
                              ? "var(--warning)"
                              : "var(--info)",
                        }}
                      />
                      <div className="activity-item__content">
                        <div className="activity-item__text">{task.title}</div>
                        <div className="activity-item__time">
                          Due {formatDate(task.dueDate)} · {task.progress}% done
                          {isOverdue(task) ? " · OVERDUE" : ""}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Escalated Issues</h2>
                <p className="card__subtitle">With developers or management</p>
              </div>
              <Link to="/support?queue=escalated" className="btn btn--ghost btn--sm">
                Escalations
              </Link>
            </div>
            {escalated.length === 0 ? (
              <EmptyState icon="⬆️" title="No escalations" text="Escalated tickets appear here." />
            ) : (
              <ul className="activity-list">
                {escalated.slice(0, 4).map((t) => (
                  <li key={t.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--warning)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">#{t.ticketNo} {t.title}</div>
                      <div className="activity-item__time">
                        With {t.escalatedToId ? data.actorName(t.escalatedToId) : "—"} ·{" "}
                        {t.escalationReason ?? ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Recent Activity</h2>
            </div>
            <ActivityList items={activityForRole} />
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">My Notifications</h2>
                <p className="card__subtitle">{myUnreadNtf.length} unread</p>
              </div>
              <Link to="/notifications" className="btn btn--ghost btn--sm">
                View all
              </Link>
            </div>
            {myUnreadNtf.length === 0 ? (
              <EmptyState icon="🔔" title="You're all caught up" text="No unread notifications." />
            ) : (
              <ul className="activity-list">
                {myUnreadNtf.slice(0, 5).map((n) => (
                  <li key={n.id} className="activity-item">
                    <span className="activity-item__dot" style={{ background: "var(--primary)" }} />
                    <div className="activity-item__content">
                      <div className="activity-item__text">{n.title}</div>
                      <div className="activity-item__time">{n.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  }
}