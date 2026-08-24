import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { Task, TaskPriority, TaskStatus } from "../data/types";
import { isOverdue } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { formatDate, formatDateTime } from "../utils/format";

const STATUS_OPTIONS: TaskStatus[] = ["not-started", "in-progress", "blocked", "completed", "cancelled"];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "normal", "high", "urgent"];

/** Worker-permitted transitions. */
const WORKER_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  "not-started": ["in-progress", "blocked"],
  "in-progress": ["completed", "blocked"],
  blocked: ["in-progress"],
  completed: [],
  cancelled: [],
};

export function TasksPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  /* ---------- scoping ---------- */
  const visibleTasks = useMemo(() => {
    if (role === "owner") return data.tasks;
    if (role === "worker" || role === "customer-service")
      return data.tasks.filter((t) => t.assigneeId === myId);
    if (role === "developer")
      return data.tasks.filter(
        (t) => t.isTechnical && (t.assigneeId === myId || t.createdById === myId),
      );
    // manager: tasks in projects they lead
    const myProjects = data.projects.filter((p) => p.builderId === myId).map((p) => p.id);
    return data.tasks.filter((t) => myProjects.includes(t.projectId));
  }, [role, data.tasks, data.projects, myId]);

  const assignablePeople = useMemo(() => {
    if (role === "owner")
      return data.people.filter(
        (p) =>
          p.kind === "worker" ||
          p.kind === "builder" ||
          p.kind === "developer" ||
          p.kind === "customer-service",
      );
    const myProjects = data.projects.filter((p) => p.builderId === myId);
    const ids = new Set<string>();
    myProjects.forEach((p) => {
      ids.add(p.builderId);
      p.workerIds.forEach((w) => ids.add(w));
    });
    return data.people.filter((p) => ids.has(p.id));
  }, [role, data.people, data.projects, myId]);

  const visibleProjects = useMemo(() => {
    if (role === "owner") return data.projects;
    if (role === "worker" || role === "customer-service") {
      /* Relevant projects only: those tied to my assigned work or tickets. */
      const projectIds = new Set(visibleTasks.map((t) => t.projectId));
      return data.projects.filter((p) => projectIds.has(p.id));
    }
    return data.projects.filter((p) => p.builderId === myId);
  }, [role, data.projects, myId, visibleTasks]);

  /* ---------- filtering ---------- */
  const filtered = visibleTasks.filter((task) => {
    const matchesSearch =
      search.trim() === "" ||
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesAssignee = assigneeFilter === "all" || task.assigneeId === assigneeFilter;
    const matchesProject = projectFilter === "all" || task.projectId === projectFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesProject;
  });

  const openCount = visibleTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length;
  const overdueCount = visibleTasks.filter(isOverdue).length;
  const blockedCount = visibleTasks.filter((t) => t.status === "blocked").length;

  const detailTask = detailTaskId ? data.tasks.find((t) => t.id === detailTaskId) : null;
  const canManage = role === "owner" || role === "manager";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">
            {role === "worker" || role === "customer-service" ? "My Tasks" : "Tasks"}
          </h1>
          <p className="page-header__subtitle">
            {role === "worker"
              ? "Your assigned work. Update progress, add notes, and report blockers."
              : role === "customer-service"
                ? "Follow-ups and support work assigned to you."
                : "Create, assign, and track work across all projects."}
          </p>
        </div>
        <div className="page-header__actions">
          {canManage && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setEditingTask(null);
                setFormOpen(true);
              }}
            >
              + Add Task
            </button>
          )}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat__label">Open Tasks</div>
          <div className="stat__value">{openCount}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Overdue</div>
          <div className="stat__value" style={{ color: overdueCount > 0 ? "var(--danger)" : undefined }}>
            {overdueCount}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Blocked</div>
          <div className="stat__value" style={{ color: blockedCount > 0 ? "var(--warning)" : undefined }}>
            {blockedCount}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Completed</div>
          <div className="stat__value">
            {visibleTasks.filter((t) => t.status === "completed").length}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="toolbar-input"
          aria-label="Search tasks"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="toolbar-select" aria-label="Filter by status">
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("-", " ")}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="toolbar-select" aria-label="Filter by priority">
          <option value="all">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {!canManage && (
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="toolbar-select" aria-label="Filter by assignee">
            <option value="all">All assignees</option>
            {assignablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="toolbar-select" aria-label="Filter by project">
          <option value="all">All projects</option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title={visibleTasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
           text={
             visibleTasks.length === 0
               ? role === "worker" || role === "customer-service"
                 ? "You currently have no tasks assigned to you. New assignments will appear here."
                 : "Create your first task to start tracking work."
               : "Try adjusting the search or filters above."
           }
          action={
            canManage && visibleTasks.length === 0 ? (
              <button
                className="btn btn--primary"
                onClick={() => {
                  setEditingTask(null);
                  setFormOpen(true);
                }}
              >
                + Add Task
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Progress</th>
                  <th>Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => {
                  const project = data.projectById(task.projectId);
                  const assignee = data.personById(task.assigneeId);
                  const overdue = isOverdue(task);
                  return (
                    <tr key={task.id} className={overdue ? "row-overdue" : ""}>
                      <td style={{ fontWeight: 500 }}>
                        {task.title}
                        {task.isTechnical && (
                          <span className="badge badge--info" style={{ marginLeft: 6 }}>
                            Technical
                          </span>
                        )}
                      </td>
                      <td>{project?.name ?? "—"}</td>
                      <td>
                        <span className="cell-person">
                          <Avatar name={assignee?.name ?? "?"} size={22} />
                          {assignee?.name ?? "—"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={task.status} />
                      </td>
                      <td>
                        <StatusBadge status={task.priority} />
                      </td>
                      <td style={{ minWidth: 110 }}>
                        <ProgressBar value={task.progress} tone={task.progress === 100 ? "success" : "primary"} />
                      </td>
                      <td>
                        <span className={overdue ? "text-danger" : ""}>{formatDate(task.dueDate)}</span>
                        {overdue && (
                          <span className="overdue-flag" title="Overdue">
                            <Icon name="alert" size={12} /> Overdue
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => setDetailTaskId(task.id)}>
                            Open
                          </button>
                          {canManage && (
                            <>
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => {
                                  setEditingTask(task);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setDeleteTarget(task)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Detail modal ---------- */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onEdit={() => {
            setEditingTask(detailTask);
            setDetailTaskId(null);
            setFormOpen(true);
          }}
        />
      )}

      {/* ---------- Create / edit modal ---------- */}
      {formOpen && (
        <TaskFormModal
          task={editingTask}
          projects={visibleProjects}
          people={assignablePeople}
          defaultCreatorId={myId}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            if (editingTask) {
              data.updateTask(
                editingTask.id,
                {
                  title: input.title,
                  description: input.description,
                  projectId: input.projectId,
                  assigneeId: input.assigneeId,
                  priority: input.priority,
                  dueDate: input.dueDate,
                },
                myId,
              );
              showToast("Task updated", "success");
            } else {
              data.addTask({ ...input, createdById: myId });
              showToast("Task created and assigned", "success");
            }
            setFormOpen(false);
          }}
        />
      )}

      {/* ---------- Delete confirm ---------- */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${deleteTarget.title}" will be permanently removed from this demo workspace.`}
          confirmLabel="Delete task"
          danger
          onConfirm={() => {
            data.deleteTask(deleteTarget.id);
            showToast("Task deleted", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );

  /* ================= Detail modal ================= */

  function TaskDetailModal({
    task,
    onClose,
    onEdit,
  }: {
    task: Task;
    onClose: () => void;
    onEdit: () => void;
  }) {
    const [comment, setComment] = useState("");
    const [progressDraft, setProgressDraft] = useState(task.progress);
    const project = data.projectById(task.projectId);
    const property = data.propertyById(task.propertyId);
    const creator = data.personById(task.createdById);
    const assignee = data.personById(task.assigneeId);

    const isMine = task.assigneeId === myId;
    // Developers get full control of technical tasks assigned to them.
    const devOwnsTechnical =
      role === "developer" && task.isTechnical && (isMine || task.createdById === myId);
    const allowedNext =
      isMine && !devOwnsTechnical ? WORKER_TRANSITIONS[task.status] : [];

    const applyStatus = (next: TaskStatus) => {
      const patch: Partial<Task> = { status: next };
      if (next === "completed") patch.progress = 100;
      if (next === "not-started") patch.progress = 0;
      data.updateTask(task.id, patch, myId);
      showToast(`Task marked ${next.replace("-", " ")}`, "success");
    };

    const saveProgress = () => {
      data.updateTask(task.id, { progress: progressDraft }, myId);
      showToast(`Progress updated to ${progressDraft}%`, "success");
    };

    return (
      <Modal
        wide
        title={task.title}
        subtitle={`${project?.name ?? "—"}${property ? ` · ${property.name}` : ""}`}
        onClose={onClose}
        footer={
          <>
            {canManage && (
              <button type="button" className="btn btn--secondary" onClick={onEdit}>
                Edit task
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <div className="task-detail-grid">
          <div>
            <div className="info-grid" style={{ marginBottom: 16 }}>
              <div className="info-item">
                <div className="info-item__label">Status</div>
                <div className="info-item__value">
                  <StatusBadge status={task.status} />
                </div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Priority</div>
                <div className="info-item__value">
                  <StatusBadge status={task.priority} />
                </div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Due date</div>
                <div className={`info-item__value ${isOverdue(task) ? "text-danger" : ""}`}>
                  {formatDate(task.dueDate)}
                </div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Created by</div>
                <div className="info-item__value">{creator?.name ?? "—"}</div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Last updated</div>
                <div className="info-item__value">{formatDateTime(task.updatedAt)}</div>
              </div>
            </div>

            {task.description && (
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16 }}>{task.description}</p>
            )}

            <ProgressBar label="Progress" value={task.progress} tone={task.progress === 100 ? "success" : "primary"} />

            {/* Worker / assignee controls */}
            {(isMine || canManage) && task.status !== "completed" && task.status !== "cancelled" && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card__header">
                  <h3 className="card__title">Update progress</h3>
                </div>
                <div className="progress-editor">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progressDraft}
                    onChange={(e) => setProgressDraft(Number(e.target.value))}
                    aria-label="Task progress percentage"
                  />
                  <span className="progress-editor__value">{progressDraft}%</span>
                  <button type="button" className="btn btn--sm btn--primary" onClick={saveProgress}>
                    Save
                  </button>
                </div>
                <div className="status-actions">
                  {(canManage || devOwnsTechnical ? STATUS_OPTIONS : allowedNext)
                    .filter((s) => s !== task.status)
                    .map((s) => (
                      <button key={s} type="button" className="btn btn--sm btn--secondary" onClick={() => applyStatus(s)}>
                        Mark {s.replace("-", " ")}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__header">
                <h3 className="card__title">Attachments</h3>
                {(isMine || canManage) && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      const name = window.prompt("Attachment file name (mock upload):");
                      if (name && name.trim()) {
                        data.addTaskAttachment(task.id, {
                          name: name.trim(),
                          kind: /\.(jpe?g|png|gif|webp)$/i.test(name) ? "photo" : "document",
                          addedAt: new Date().toISOString(),
                          addedBy: myId,
                        });
                        showToast("Attachment added (mock)", "success");
                      }
                    }}
                  >
                    <Icon name="paperclip" size={13} /> Add
                  </button>
                )}
              </div>
              {task.attachments.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>No attachments yet.</p>
              ) : (
                <ul className="attachment-list">
                  {task.attachments.map((a) => (
                    <li key={a.id}>
                      <Icon name={a.kind === "photo" ? "camera" : "documents"} size={14} />
                      <span>{a.name}</span>
                      <small>
                        {a.kind} · {formatDateTime(a.addedAt)} · {data.actorName(a.addedBy)}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Comments column */}
          <div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card__header">
                <h3 className="card__title">Comments & updates ({task.comments.length})</h3>
              </div>
              {task.comments.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginBottom: 12 }}>
                  No comments yet.
                </p>
              ) : (
                <ul className="comment-list">
                  {task.comments.map((c) => (
                    <li key={c.id} className="comment">
                      <Avatar name={data.actorName(c.authorId)} size={26} />
                      <div className="comment__body">
                        <div className="comment__meta">
                          <strong>{data.actorName(c.authorId)}</strong>
                          <time>{formatDateTime(c.createdAt)}</time>
                        </div>
                        <p>{c.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="comment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  data.addTaskComment(task.id, myId, comment.trim());
                  setComment("");
                  showToast("Comment added", "success");
                }}
              >
                <textarea
                  placeholder={isMine ? "Add a work note…" : "Add a comment…"}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  aria-label="Add comment"
                />
                <button type="submit" className="btn btn--sm btn--primary" disabled={!comment.trim()}>
                  Post
                </button>
              </form>
            </div>
            {assignee && (
              <div className="assignee-chip">
                <Avatar name={assignee.name} size={28} />
                <div>
                  <strong>{assignee.name}</strong>
                  <small>{assignee.title}</small>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  /* ================= Form modal ================= */

  function TaskFormModal({
    task,
    projects,
    people,
    defaultCreatorId,
    onClose,
    onSubmit,
  }: {
    task: Task | null;
    projects: typeof data.projects;
    people: typeof data.people;
    defaultCreatorId: string;
    onClose: () => void;
    onSubmit: (input: {
      projectId: string;
      title: string;
      description?: string;
      assigneeId: string;
      priority: TaskPriority;
      dueDate: string;
      createdById: string;
      isTechnical?: boolean;
    }) => void;
  }) {
    const [projectId, setProjectId] = useState(task?.projectId ?? projects[0]?.id ?? "");
    const [title, setTitle] = useState(task?.title ?? "");
    const [description, setDescription] = useState(task?.description ?? "");
    const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? people[0]?.id ?? "");
    const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
    const [dueDate, setDueDate] = useState(task?.dueDate ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    const [isTechnical, setIsTechnical] = useState(Boolean(task?.isTechnical));
    const [errors, setErrors] = useState<string[]>([]);

    const submit = () => {
      const errs: string[] = [];
      if (!title.trim()) errs.push("Title is required.");
      if (!projectId) errs.push("Choose a project.");
      if (!assigneeId) errs.push("Choose an assignee.");
      if (!dueDate) errs.push("Pick a due date.");
      setErrors(errs);
      if (errs.length > 0) return;
      onSubmit({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId,
        priority,
        dueDate,
        createdById: task?.createdById ?? defaultCreatorId,
        isTechnical,
      });
    };

    return (
      <Modal
        title={task ? "Edit task" : "New task"}
        subtitle={task ? "Update task details or reassign work." : "Create and assign a task to a team member."}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={submit}>
              {task ? "Save changes" : "Create task"}
            </button>
          </>
        }
      >
        {errors.length > 0 && (
          <div className="form-errors" role="alert">
            {errors.map((e) => (
              <div key={e}>• {e}</div>
            ))}
          </div>
        )}
        <div className="form-grid">
          <div className="form-group form-group--full">
            <label htmlFor="task-title">Title *</label>
            <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Install electrical conduits — second floor" />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="task-desc">Description</label>
            <textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What exactly needs to be done?" />
          </div>
          <div className="form-group">
            <label htmlFor="task-project">Project *</label>
            <select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-assignee">Assign to *</label>
            <select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-priority">Priority</label>
            <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-due">Due date *</label>
            <input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {canManage && (
            <div className="form-group form-group--full">
              <label className="checkbox-item" htmlFor="task-technical">
                <input
                  id="task-technical"
                  type="checkbox"
                  checked={isTechnical}
                  onChange={(e) => setIsTechnical(e.target.checked)}
                />
                Technical / system task (visible to Developers)
              </label>
            </div>
          )}
        </div>
      </Modal>
    );
  }
}