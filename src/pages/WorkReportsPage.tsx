import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { WorkReport } from "../data/types";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { formatDate } from "../utils/format";

/** Worker field reports: submit daily/weekly work reports with mock photos. */
export function WorkReportsPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [formOpen, setFormOpen] = useState(false);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";

  const myProjects = useMemo(
    () => data.projects.filter((p) => p.workerIds.includes(myId)),
    [data.projects, myId],
  );

  const visibleReports = useMemo(() => {
    if (user.role === "worker") {
      return data.workReports.filter((r) => r.authorId === myId);
    }
    // Builders can review reports for their projects.
    const myProjectIds = data.projects.filter((p) => p.builderId === myId).map((p) => p.id);
    return data.workReports.filter((r) => myProjectIds.includes(r.projectId));
  }, [data.workReports, data.projects, user.role, myId]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{user.role === "worker" ? "My Reports" : "Field Reports"}</h1>
          <p className="page-header__subtitle">
            {user.role === "worker"
              ? "Submit progress and issue reports from the field."
              : "Work and issue reports submitted by your crew."}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
            + New Report
          </button>
        </div>
      </div>

      {visibleReports.length === 0 ? (
        <EmptyState
          icon="📝"
          title={data.workReports.length === 0 ? "No reports yet" : "No reports to show"}
          text={
            data.workReports.length === 0
              ? "Submit your first field report — include what you accomplished and any problems."
              : "Try again later."
          }
          action={
            <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
              + New Report
            </button>
          }
        />
      ) : (
        <div className="report-cards">
          {visibleReports.map((report) => (
            <article key={report.id} className="card report-card">
              <div className="report-card__head">
                <Avatar name={data.actorName(report.authorId)} size={30} />
                <div>
                  <h3>{report.title}</h3>
                  <small>
                    {data.projectById(report.projectId)?.name ?? "—"} · {formatDate(report.date)}
                  </small>
                </div>
              </div>
              <p>{report.notes}</p>
              {report.photos.length > 0 && (
                <div className="report-card__photos">
                  {report.photos.map((photo) => (
                    <span key={photo} className="photo-chip">
                      <Icon name="camera" size={13} /> {photo}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <ReportFormModal
          projects={myProjects}
          tasks={data.tasks.filter((t) => t.assigneeId === myId)}
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            data.addWorkReport({ ...input, authorId: myId });
            showToast("Report submitted", "success");
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ReportFormModal({
  projects,
  tasks,
  onClose,
  onSubmit,
}: {
  projects: ReturnType<typeof useData>["projects"];
  tasks: ReturnType<typeof useData>["tasks"];
  onClose: () => void;
  onSubmit: (input: Omit<WorkReport, "id" | "authorId">) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [photosInput, setPhotosInput] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const relatedTasks = tasks.filter((t) => t.projectId === projectId);

  const submit = () => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Title is required.");
    if (!notes.trim()) errs.push("Notes are required.");
    if (!projectId) errs.push("Choose a project.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      projectId,
      taskId: taskId || undefined,
      title: title.trim(),
      notes: notes.trim(),
      date: new Date().toISOString().slice(0, 10),
      photos: photosInput
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    });
  };

  return (
    <Modal
      title="New field report"
      subtitle="Photo names are mock attachments in this demo build."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Submit report
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
          <label htmlFor="wr-title">Title *</label>
          <input id="wr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Daily report — master bath tiling" />
        </div>
        <div className="form-group">
          <label htmlFor="wr-project">Project *</label>
          <select id="wr-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="wr-task">Related task (optional)</label>
          <select id="wr-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">None</option>
            {relatedTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="wr-notes">Notes *</label>
          <textarea id="wr-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you accomplish? Any problems or blockers?" />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="wr-photos">Photos (comma-separated file names)</label>
          <input id="wr-photos" value={photosInput} onChange={(e) => setPhotosInput(e.target.value)} placeholder="wall-progress.jpg, delivery-note.jpg" />
        </div>
      </div>
    </Modal>
  );
}