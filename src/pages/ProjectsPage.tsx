import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { Project, ProjectStatus } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ProgressBar } from "../components/ui/ProgressBar";
import { formatCurrency } from "../utils/format";

const PROJECT_STATUSES: ProjectStatus[] = ["in-progress", "pending", "on-hold", "completed"];

export function ProjectsPage() {
  const { user, showToast } = useApp();
  const data = useData();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"all" | "active" | "completed">("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;
  const canManage = role === "owner" || role === "manager";

  const visibleProjects = useMemo(() => {
    if (role === "owner") return data.projects;
    if (role === "worker") return data.projects.filter((p) => p.workerIds.includes(myId));
    if (role === "manager") return data.projects.filter((p) => p.builderId === myId);
    /* Customer Service: only projects tied to tickets assigned/escalated to them. */
    const ticketPropIds = new Set(
      data.requests
        .filter((r) => r.assignedToId === myId || r.escalatedToId === myId)
        .map((r) => r.propertyId),
    );
    return data.projects.filter((p) => ticketPropIds.has(p.propertyId));
  }, [role, data.projects, data.properties, data.requests, myId]);

  const filtered = visibleProjects.filter((p) => {
    const matchesTab =
      tab === "all" ? true : tab === "active" ? p.status !== "completed" : p.status === "completed";
    const matchesSearch = search.trim() === "" || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{role === "manager" ? "My Projects" : "Projects"}</h1>
          <p className="page-header__subtitle">
            {role === "worker"
              ? "Projects you are assigned to."
              : role === "customer-service"
                ? "Projects related to the tickets you handle."
                : "Manage construction projects, tasks, materials, and expenses."}
          </p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label="Search projects"
          />
          {canManage && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + New Project
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(["all", "active", "completed"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>
            {t === "all" ? "All Projects" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔨"
          title={visibleProjects.length === 0 ? "No projects yet" : "No projects found"}
          text={
            visibleProjects.length === 0
              ? canManage
                ? "Create a project to start tracking construction work."
                : "Projects will appear here once work begins on your property."
              : "Try adjusting your search or filter."
          }
          action={
            canManage && visibleProjects.length === 0 ? (
              <button
                className="btn btn--primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                + New Project
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
                  <th>Project</th>
                  <th>Property</th>
                  <th>Status</th>
                  <th style={{ minWidth: 140 }}>Progress</th>
                  {canManage && <th>Budget</th>}
                  {canManage && <th>Spent</th>}
                  <th>Builder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const property = data.propertyById(project.propertyId);
                  const builder = data.personById(project.builderId);
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projects/${project.id}`} style={{ fontWeight: 500 }}>
                          {project.name}
                        </Link>
                      </td>
                      <td>{property?.name ?? "—"}</td>
                      <td>
                        <StatusBadge status={project.status} />
                      </td>
                      <td>
                        <ProgressBar value={project.progress} tone={project.progress === 100 ? "success" : "primary"} />
                      </td>
                      {canManage && <td>{formatCurrency(project.budget)}</td>}
                      {canManage && <td>{formatCurrency(project.spent)}</td>}
                      <td>{builder?.name ?? "—"}</td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/projects/${project.id}`} className="btn btn--ghost btn--sm">
                            View
                          </Link>
                          {canManage && (
                            <>
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => {
                                  setEditing(project);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              {role === "owner" && (
                                <button className="btn btn--ghost btn--sm" onClick={() => setDeleteTarget(project)}>
                                  Delete
                                </button>
                              )}
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

      {formOpen && (
        <ProjectFormModal
          project={editing}
          properties={data.properties}
          builders={data.people.filter((p) => p.kind === "builder")}
          workers={data.people.filter((p) => p.kind === "worker")}
          defaultBuilderId={role === "manager" ? myId : undefined}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            if (editing) {
              data.updateProject(editing.id, input);
              showToast("Project updated", "success");
            } else {
              const created = data.addProject(input);
              showToast("Project created", "success");
              navigate(`/projects/${created.id}`);
            }
            setFormOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${deleteTarget.name}" and its tasks will be permanently removed from the demo workspace.`}
          confirmLabel="Delete project"
          danger
          onConfirm={() => {
            data.deleteProject(deleteTarget.id);
            showToast("Project deleted", "info");
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ProjectFormModal({
  project,
  properties,
  builders,
  workers,
  defaultBuilderId,
  onClose,
  onSubmit,
}: {
  project: Project | null;
  properties: ReturnType<typeof useData>["properties"];
  builders: ReturnType<typeof useData>["people"];
  workers: ReturnType<typeof useData>["people"];
  defaultBuilderId?: string;
  onClose: () => void;
  onSubmit: (input: Omit<Project, "id">) => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [propertyId, setPropertyId] = useState(project?.propertyId ?? properties[0]?.id ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "in-progress");
  const [budget, setBudget] = useState(String(project?.budget ?? ""));
  const [spent, setSpent] = useState(String(project?.spent ?? "0"));
  const [startDate, setStartDate] = useState(project?.startDate ?? new Date().toISOString().slice(0, 10));
  const [targetEndDate, setTargetEndDate] = useState(project?.targetEndDate ?? "");
  const [progress, setProgress] = useState(String(project?.progress ?? 0));
  const [builderId, setBuilderId] = useState(project?.builderId ?? defaultBuilderId ?? builders[0]?.id ?? "");
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(project?.workerIds ?? []);
  const [description, setDescription] = useState(project?.description ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  };

  const submit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required.");
    if (!propertyId) errs.push("Choose a property.");
    if (!builderId) errs.push("Choose a builder.");
    if (Number.isNaN(Number(budget)) || budget === "") errs.push("Budget must be a number.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      name: name.trim(),
      propertyId,
      status,
      budget: Number(budget),
      spent: Number(spent) || 0,
      startDate,
      targetEndDate: targetEndDate || undefined,
      endDate: project?.endDate,
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      builderId,
      workerIds: selectedWorkers,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal
      wide
      title={project ? "Edit project" : "New project"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {project ? "Save changes" : "Create project"}
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
          <label htmlFor="proj-name">Name *</label>
          <input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen Renovation" />
        </div>
        <div className="form-group">
          <label htmlFor="proj-property">Property *</label>
          <select id="proj-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="proj-status">Status</label>
          <select id="proj-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s}>{s.replace("-", " ")}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="proj-builder">Builder *</label>
          <select id="proj-builder" value={builderId} onChange={(e) => setBuilderId(e.target.value)}>
            {builders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="proj-budget">Budget (₱) *</label>
          <input id="proj-budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="proj-spent">Spent (₱)</label>
          <input id="proj-spent" inputMode="numeric" value={spent} onChange={(e) => setSpent(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="proj-start">Start date</label>
          <input id="proj-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="proj-target">Target completion</label>
          <input id="proj-target" type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="proj-progress">Progress (%)</label>
          <input id="proj-progress" inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label>Assigned workers</label>
          <div className="checkbox-row">
            {workers.map((w) => (
              <label key={w.id} className="checkbox-item">
                <input type="checkbox" checked={selectedWorkers.includes(w.id)} onChange={() => toggleWorker(w.id)} />
                {w.name} — {w.title}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="proj-desc">Description</label>
          <textarea id="proj-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}