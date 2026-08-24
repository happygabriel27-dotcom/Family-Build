/* ============================================================
   FamilyBuild — Suggestions & Feedback
   ------------------------------------------------------------
   Any signed-in user can submit suggestions/feedback/ideas.
   Owner and Customer Service review them: change status and
   add a response; the submitter is notified automatically.
   ============================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { can } from "../data/permissions";
import type { Suggestion, SuggestionCategory, SuggestionStatus } from "../data/types";
import { StatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Avatar } from "../components/ui/Avatar";
import { timeAgo } from "../utils/format";

const CATEGORIES: SuggestionCategory[] = [
  "Feature Idea",
  "Improvement",
  "Bug Report",
  "Process",
  "Other",
];

const STATUSES: SuggestionStatus[] = ["new", "under-review", "planned", "completed", "declined"];

export function SuggestionsPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [formOpen, setFormOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Suggestion | null>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;
  const mayReview = can(role, "suggestion.review");

  const list = useMemo(
    () => [...data.suggestions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.suggestions],
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Suggestions</h1>
          <p className="page-header__subtitle">
            {mayReview
              ? "Review feedback and improvement ideas from the whole team and our clients."
              : "Share ideas, feedback, or report friction — the team reviews every submission."}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
            + New Suggestion
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="💡"
          title="No suggestions yet"
          text="Be the first to share an idea — big or small."
          action={
            <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
              + New Suggestion
            </button>
          }
        />
      ) : (
        <div className="suggestion-list">
          {list.map((s) => {
            const author = data.personById(s.userId);
            return (
              <article key={s.id} className="card suggestion-card">
                <div className="suggestion-card__head">
                  <Avatar name={author?.name ?? "?"} size={30} />
                  <div className="suggestion-card__meta">
                    <h3>{s.title}</h3>
                    <small>
                      {author?.name ?? "—"} · {s.category} · {timeAgo(s.createdAt)}
                    </small>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <p>{s.description}</p>
                {s.response && (
                  <p className="suggestion-card__response">
                    <strong>Team response:</strong> {s.response}
                  </p>
                )}
                {mayReview && (
                  <div className="suggestion-card__actions">
                    <button className="btn btn--sm btn--secondary" onClick={() => setReviewing(s)}>
                      Review
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {formOpen && (
        <SuggestionFormModal
          onClose={() => setFormOpen(false)}
          onSubmit={(input) => {
            data.addSuggestion({ ...input, userId: myId });
            showToast("Suggestion submitted — thank you!", "success");
            setFormOpen(false);
          }}
        />
      )}

      {reviewing && (
        <ReviewSuggestionModal
          suggestion={reviewing}
          onClose={() => setReviewing(null)}
          onSubmit={(status, response) => {
            data.updateSuggestionStatus(reviewing.id, status, response);
            showToast(`Suggestion marked ${status} — submitter notified`, "success");
            setReviewing(null);
          }}
        />
      )}
    </div>
  );
}

function SuggestionFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; description: string; category: SuggestionCategory }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SuggestionCategory>("Feature Idea");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Title is required.");
    if (!description.trim()) errs.push("Description is required.");
    setErrors(errs);
    if (errs.length > 0) return;
    onSubmit({ title: title.trim(), description: description.trim(), category });
  };

  return (
    <Modal
      title="New suggestion"
      subtitle="Ideas, feedback, improvements, or friction you've noticed."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Submit
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
          <label htmlFor="sug-title">Title *</label>
          <input
            id="sug-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly photo updates on project page"
          />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="sug-category">Category</label>
          <select id="sug-category" value={category} onChange={(e) => setCategory(e.target.value as SuggestionCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="sug-desc">Description *</label>
          <textarea
            id="sug-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's your idea? What problem does it solve?"
          />
        </div>
      </div>
    </Modal>
  );
}

function ReviewSuggestionModal({
  suggestion,
  onClose,
  onSubmit,
}: {
  suggestion: Suggestion;
  onClose: () => void;
  onSubmit: (status: SuggestionStatus, response?: string) => void;
}) {
  const [status, setStatus] = useState<SuggestionStatus>(suggestion.status);
  const [response, setResponse] = useState(suggestion.response ?? "");

  return (
    <Modal
      title={`Review: ${suggestion.title}`}
      subtitle={`${suggestion.category} · submitted ${timeAgo(suggestion.createdAt)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onSubmit(status, response)}>
            Save review
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 14 }}>{suggestion.description}</p>
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="rev-status">Status</label>
          <select id="rev-status" value={status} onChange={(e) => setStatus(e.target.value as SuggestionStatus)}>
            {STATUSES.map((s) => (
              <option key={s}>{s.replace("-", " ")}</option>
            ))}
          </select>
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="rev-response">Response to submitter (optional)</label>
          <textarea
            id="rev-response"
            rows={3}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="e.g. Great idea — planned for the next release."
          />
        </div>
      </div>
    </Modal>
  );
}