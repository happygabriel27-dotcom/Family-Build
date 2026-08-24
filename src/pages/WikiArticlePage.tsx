import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import type { WikiArticle } from "../data/types";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { formatDate } from "../utils/format";

/** Renders the simple markdown-ish content: # / ## headings, - lists, paragraphs. */
function ArticleBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="wiki-article__body">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("## ")) {
          return <h3 key={i}>{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith("# ")) {
          return <h2 key={i}>{trimmed.slice(2)}</h2>;
        }
        if (/^[-*] /m.test(trimmed) && trimmed.split("\n").every((l) => /^[-*] /.test(l.trim()))) {
          return (
            <ul key={i}>
              {trimmed.split("\n").map((line, j) => (
                <li key={j}>{line.trim().slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{trimmed}</p>;
      })}
    </div>
  );
}

export function WikiArticlePage() {
  const { user, showToast } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const { articleId } = useParams<{ articleId: string }>();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!user) return null;
  const isOwner = user.role === "owner";
  const isNew = articleId === "new";

  const article = isNew ? null : data.wikiArticles.find((a) => a.id === articleId);

  if (isNew && !isOwner) {
    return (
      <EmptyState
        icon="🔒"
        title="Owner access required"
        text="Only the Owner can publish new wiki articles."
        action={
          <Link to="/wiki" className="btn btn--primary">
            Back to Wiki
          </Link>
        }
      />
    );
  }

  if (!isNew && !article) {
    return (
      <EmptyState
        icon="📚"
        title="Article not found"
        text="This article may have been removed."
        action={
          <Link to="/wiki" className="btn btn--primary">
            Back to Wiki
          </Link>
        }
      />
    );
  }

  const related = (article?.relatedIds ?? [])
    .map((id) => data.wikiArticles.find((a) => a.id === id))
    .filter((a): a is WikiArticle => Boolean(a));
  const category = article ? data.wikiCategories.find((c) => c.id === article.categoryId) : undefined;

  return (
    <div className="wiki-article">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link to="/wiki" className="text-muted-link" style={{ fontSize: 13 }}>
              ← Back to Wiki
            </Link>
          </div>
          <small className="wiki-card__category">{category?.name ?? "Uncategorized"}</small>
          <h1 className="page-header__title">{isNew ? "New article" : article!.title}</h1>
          {!isNew && (
            <p className="page-header__subtitle">
              By {data.actorName(article!.authorId)} · Updated {formatDate(article!.updatedAt)}
            </p>
          )}
        </div>
        {!isNew && isOwner && (
          <div className="page-header__actions">
            <button className="btn btn--secondary" onClick={() => setEditOpen(true)}>
              Edit
            </button>
            <button className="btn btn--danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </button>
          </div>
        )}
      </div>

      {isNew ? (
        <EmptyState
          icon="✍️"
          title="Drafting a new article"
          text="Use the editor below to publish a new guide or study."
          action={
            <button className="btn btn--primary" onClick={() => setEditOpen(true)}>
              Open editor
            </button>
          }
        />
      ) : (
        <>
          <p className="wiki-article__summary">{article!.summary}</p>
          <ArticleBody content={article!.content} />

          {article!.tags.length > 0 && (
            <div className="wiki-tags">
              {article!.tags.map((tag) => (
                <span key={tag} className="wiki-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {related.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card__header">
                <h3 className="card__title">Related articles</h3>
              </div>
              <ul className="related-list">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/wiki/${r.id}`}>{r.title}</Link>
                    <p>{r.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {(editOpen || (isNew && editOpen)) && (
        <ArticleEditorModal
          article={article ?? undefined}
          categories={data.wikiCategories}
          authorId={user.personId}
          onClose={() => {
            setEditOpen(false);
            if (isNew) navigate("/wiki");
          }}
          onSubmit={(input) => {
            if (article) {
              data.updateWikiArticle(article.id, input);
              showToast("Article updated", "success");
            } else {
              const created = data.addWikiArticle(input);
              showToast("Article published", "success");
              navigate(`/wiki/${created.id}`);
            }
            setEditOpen(false);
          }}
        />
      )}

      {deleteOpen && article && (
        <ConfirmDialog
          title="Delete article?"
          message={`"${article.title}" will be removed from the wiki.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            data.deleteWikiArticle(article.id);
            showToast("Article deleted", "info");
            navigate("/wiki");
          }}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}

function ArticleEditorModal({
  article,
  categories,
  authorId,
  onClose,
  onSubmit,
}: {
  article?: WikiArticle;
  categories: ReturnType<typeof useData>["wikiCategories"];
  authorId: string;
  onClose: () => void;
  onSubmit: (input: Omit<WikiArticle, "id">) => void;
}) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? categories[0]?.id ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [tagsInput, setTagsInput] = useState((article?.tags ?? []).join(", "));
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Title is required.");
    if (!summary.trim()) errs.push("Summary is required.");
    if (!content.trim()) errs.push("Content is required.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      categoryId,
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      tags: tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      authorId,
      updatedAt: new Date().toISOString().slice(0, 10),
      relatedIds: article?.relatedIds ?? [],
    });
  };

  return (
    <Modal
      wide
      title={article ? "Edit article" : "New article"}
      subtitle="Supports # and ## headings, - bullet lists, and plain paragraphs separated by blank lines."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            {article ? "Save changes" : "Publish"}
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
          <label htmlFor="wa-title">Title *</label>
          <input id="wa-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="wa-category">Category</label>
          <select id="wa-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="wa-tags">Tags (comma-separated)</label>
          <input id="wa-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="safety, procedure" />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="wa-summary">Summary *</label>
          <input id="wa-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label htmlFor="wa-content">Content *</label>
          <textarea id="wa-content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}