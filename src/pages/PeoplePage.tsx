import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { Person, PersonKind, PersonStatus } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Avatar } from "../components/ui/Avatar";

const KIND_META: Record<PersonKind, { title: string; subtitle: string; icon: string }> = {
  admin: {
    title: "Owners",
    subtitle: "Organization owner accounts with full administrative access.",
    icon: "user",
  },
  manager: {
    title: "Managers",
    subtitle: "Leads responsible for project coordination and team execution.",
    icon: "briefcase",
  },
  builder: {
    title: "Managers",
    subtitle: "Leads responsible for project coordination and team execution.",
    icon: "briefcase",
  },
  developer: {
    title: "Developers",
    subtitle: "Technical team responsible for the FamilyBuild platform.",
    icon: "briefcase",
  },
  worker: {
    title: "Workers",
    subtitle: "Field crew who execute tasks on site.",
    icon: "users",
  },
  "property-owner": {
    title: "Property Owners",
    subtitle: "Legacy records retained for compatibility.",
    icon: "home",
  },
  "customer-service": {
    title: "Customer Service",
    subtitle: "Agents who handle client requests, problems, and support tickets.",
    icon: "help",
  },
};

export function PeoplePage({ kind }: { kind: PersonKind }) {
  const { user, showToast } = useApp();
  const data = useData();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [taskTarget, setTaskTarget] = useState<Person | null>(null);

  if (!user) return null;
  const canManage = user.role === "owner" || user.role === "manager";
  /* The Owners page lists the organization's owner account(s) — read-only. */
  const meta = KIND_META[kind];
  const canAdd = canManage && kind !== "admin";

  const people = useMemo(
    () => data.people.filter((p) => p.kind === kind || (kind === "manager" && p.kind === "builder")),
    [data.people, kind],
  );

  const unassignedOnly = new URLSearchParams(location.search).get("unassigned") === "true";

  const filtered = people.filter((p) => {
    const matchesSearch =
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase());
    const matchesUnassigned = !unassignedOnly || (!p.projectIds || p.projectIds.length === 0);
    return matchesSearch && matchesUnassigned;
  });

  const unassignedWorkers = useMemo(
    () =>
      data.people.filter(
        (p) =>
          p.kind === "worker" &&
          (!p.projectIds || p.projectIds.length === 0) &&
          p.status === "active",
      ),
    [data.people],
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{meta.title}</h1>
          <p className="page-header__subtitle">{meta.subtitle}</p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder={`Search ${meta.title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label={`Search ${meta.title}`}
          />
          {canAdd && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + Add {kind === "customer-service" ? "Customer Service" : kind.charAt(0).toUpperCase() + kind.slice(1)}
            </button>
          )}
        </div>
      </div>

      {kind === "worker" && unassignedWorkers.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__header">
            <div>
              <h2 className="card__title">Unassigned Workers</h2>
              <p className="card__subtitle">Workers without an active team or project assignment.</p>
            </div>
          </div>
          <div className="checkbox-row">
            {unassignedWorkers.map((person) => (
              <span key={person.id} className="badge badge--warning" style={{ marginRight: 8 }}>
                {person.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title={people.length === 0 ? `No ${meta.title.toLowerCase()} yet` : "No matches"}
          text={
            people.length === 0
              ? canManage
                ? `Add your first ${kind.replace("-", " ")} to get started.`
                : "Records will appear here once added by the owner."
              : "Try a different search."
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>{kind === "worker" ? "Specialty" : "Title"}</th>
                  <th>{kind === "property-owner" ? "Properties" : "Projects"}</th>
                  {kind === "worker" && <th>Open Tasks</th>}
                  {kind === "property-owner" && <th>Open Requests</th>}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => {
                  const projectCount = person.projectIds?.length ?? 0;
                  const propertyIds = person.propertyIds ?? [];
                  const openTasks =
                    kind === "worker"
                      ? data.tasks.filter(
                          (t) => t.assigneeId === person.id && t.status !== "completed" && t.status !== "cancelled",
                        ).length
                      : undefined;
                  const openRequests =
                    kind === "property-owner"
                      ? data.requests.filter(
                          (r) =>
                            r.submittedById === person.id &&
                            r.status !== "resolved" &&
                            r.status !== "closed",
                        ).length
                      : undefined;
                  return (
                    <tr key={person.id}>
                      <td>
                        <span className="cell-person">
                          <Avatar name={person.name} size={26} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{person.name}</div>
                            <small style={{ color: "var(--text-muted)" }}>{person.email}</small>
                          </div>
                        </span>
                      </td>
                      <td>{person.phone}</td>
                      <td>{kind === "worker" ? person.specialty ?? person.title : person.title}</td>
                      <td>
                        {kind === "property-owner"
                          ? propertyIds.length > 0
                            ? propertyIds.map((pid) => data.propertyById(pid)?.name).join(", ")
                            : "—"
                          : projectCount > 0
                            ? `${projectCount} assigned`
                            : "—"}
                      </td>
                      {openTasks !== undefined && (
                        <td>{openTasks > 0 ? <strong>{openTasks}</strong> : "0"}</td>
                      )}
                      {openRequests !== undefined && (
                        <td>{openRequests > 0 ? <span className="text-danger">{openRequests} open</span> : "0"}</td>
                      )}
                      <td>
                        <StatusBadge status={person.status} />
                      </td>
                      <td>
                        <div className="table-actions">
                          {canManage && (
                            <>
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => {
                                  setEditing(person);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setDeleteTarget(person)}>
                                Delete
                              </button>
                            </>
                          )}
                          {(kind === "worker" || kind === "manager" || kind === "customer-service") && (
                            <button
                              className="btn btn--primary btn--sm"
                              onClick={() => setTaskTarget(person)}
                            >
                              Add Task
                            </button>
                          )}
                          {kind === "property-owner" && propertyIds[0] && (
                            <Link to={`/properties/${propertyIds[0]}`} className="btn btn--ghost btn--sm">
                              Property
                            </Link>
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

      {formOpen && (
        <PersonFormModal
          kind={kind}
          person={editing}
          properties={data.properties}
          projects={data.projects}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            if (editing) {
              data.updatePerson(editing.id, input);
              showToast("Record updated", "success");
            } else {
              data.addPerson(input);
              showToast("Record added", "success");
            }
            setFormOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Remove ${deleteTarget.name}?`}
          message="This removes the directory record from the demo workspace. Existing tasks and messages keep their history."
          confirmLabel="Remove"
          danger
          onConfirm={() => {
            data.deletePerson(deleteTarget.id);
            showToast("Record removed", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {taskTarget && (
        <TaskDraftModal
          person={taskTarget}
          projects={data.projects}
          currentUserId={user.personId}
          onClose={() => setTaskTarget(null)}
          onSubmit={(input) => {
            data.addTask({
              ...input,
              assigneeId: taskTarget.id,
              createdById: user.personId,
            });
            showToast(`Task assigned to ${taskTarget.name}`, "success");
            setTaskTarget(null);
          }}
        />
      )}
    </div>
  );
}

function PersonFormModal({
  kind,
  person,
  properties,
  projects,
  onClose,
  onSubmit,
}: {
  kind: PersonKind;
  person: Person | null;
  properties: ReturnType<typeof useData>["properties"];
  projects: ReturnType<typeof useData>["projects"];
  onClose: () => void;
  onSubmit: (input: Omit<Person, "id">) => void;
}) {
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [title, setTitle] = useState(person?.title ?? "");
  const [specialty, setSpecialty] = useState(person?.specialty ?? "");
  const [status, setStatus] = useState<PersonStatus>(person?.status ?? "active");
  const [projectIds, setProjectIds] = useState<string[]>(person?.projectIds ?? []);
  const [propertyIds, setPropertyIds] = useState<string[]>(person?.propertyIds ?? []);
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (!email.trim()) errs.push("Email is required.");
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.push("Enter a valid email address.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      kind,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      title:
        title.trim() ||
        (kind === "builder"
          ? "Builder"
          : kind === "developer"
            ? "Developer"
            : kind === "worker"
              ? "Worker"
              : kind === "customer-service"
                ? "Customer Service Agent"
                : "Property Owner"),
      status,
      specialty: specialty.trim() || undefined,
      projectIds: kind === "property-owner" ? [] : projectIds,
      propertyIds: kind === "property-owner" ? propertyIds : [],
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      wide
      title={person ? `Edit ${KIND_META[kind].title.replace(/s$/, "")}` : `Add ${KIND_META[kind].title.replace(/s$/, "")}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {person ? "Save changes" : "Add record"}
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
        <div className="form-group">
          <label htmlFor="per-name">Name *</label>
          <input id="per-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="per-email">Email *</label>
          <input id="per-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="per-phone">Phone</label>
          <input id="per-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="per-title">{kind === "worker" ? "Role / trade" : "Title"}</label>
          <input id="per-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "worker" ? "e.g. Mason" : "e.g. Construction Manager"} />
        </div>
        {kind === "worker" && (
          <div className="form-group">
            <label htmlFor="per-specialty">Specialty</label>
            <input id="per-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Masonry & Concrete" />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="per-status">Status</label>
          <select id="per-status" value={status} onChange={(e) => setStatus(e.target.value as PersonStatus)}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>

        {kind !== "property-owner" && (
          <div className="form-group form-group--full">
            <label>Assigned projects</label>
            <div className="checkbox-row">
              {projects.map((pr) => (
                <label key={pr.id} className="checkbox-item">
                  <input type="checkbox" checked={projectIds.includes(pr.id)} onChange={() => toggle(projectIds, setProjectIds, pr.id)} />
                  {pr.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {kind === "property-owner" && (
          <div className="form-group form-group--full">
            <label>Owned properties</label>
            <div className="checkbox-row">
              {properties.map((pr) => (
                <label key={pr.id} className="checkbox-item">
                  <input type="checkbox" checked={propertyIds.includes(pr.id)} onChange={() => toggle(propertyIds, setPropertyIds, pr.id)} />
                  {pr.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-group form-group--full">
          <label htmlFor="per-notes">Notes</label>
          <textarea id="per-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function TaskDraftModal({
  person,
  projects,
  currentUserId,
  onClose,
  onSubmit,
}: {
  person: Person;
  projects: ReturnType<typeof useData>["projects"];
  currentUserId: string;
  onClose: () => void;
  onSubmit: (input: {
    projectId: string;
    title: string;
    description?: string;
    assigneeId: string;
    priority: "low" | "normal" | "high" | "urgent";
    dueDate: string;
    createdById: string;
    isTechnical?: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      projectId: projectId || projects[0]?.id || "",
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: person.id,
      priority,
      dueDate,
      createdById: currentUserId,
      isTechnical: false,
    });
  };

  return (
    <Modal
      title={`Add Task for ${person.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Create task
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group form-group--full">
          <label htmlFor="task-title">Task title</label>
          <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="task-project">Project</label>
          <select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="task-priority">Priority</label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high" | "urgent")}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="task-due-date">Due date</label>
          <input id="task-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="task-description">Description</label>
          <textarea id="task-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}