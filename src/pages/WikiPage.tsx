import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { formatDate } from "../utils/format";

export function WikiPage() {
  const { user } = useApp();
  const data = useData();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  if (!user) return null;
  const isOwner = user.role === "owner";

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.wikiArticles.filter((a) => {
      const matchesCategory = activeCategory === "all" || a.categoryId === activeCategory;
      const matchesSearch =
        q === "" ||
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)) ||
        a.content.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [data.wikiArticles, activeCategory, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Wiki</h1>
          <p className="page-header__subtitle">
            Studies, guides, procedures, and internal documentation.
            {isOwner ? " As Owner you can publish and edit articles." : " Read-only access for builders."}
          </p>
        </div>
        <div className="page-header__actions">
          <input
            type="search"
            placeholder="Search the wiki..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-input"
            aria-label="Search wiki"
          />
          {isOwner && (
            <Link to="/wiki/new" className="btn btn--primary">
              + New Article
            </Link>
          )}
        </div>
      </div>

      <div className="wiki-layout">
        <aside className="wiki-categories" aria-label="Wiki categories">
          <button
            type="button"
            className={`wiki-cat ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            <Icon name="book" size={15} />
            All Articles
            <span className="wiki-cat__count">{data.wikiArticles.length}</span>
          </button>
          {data.wikiCategories.map((cat) => {
            const count = data.wikiArticles.filter((a) => a.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                className={`wiki-cat ${activeCategory === cat.id ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.description}
              >
                <Icon name={cat.icon} size={15} />
                {cat.name}
                <span className="wiki-cat__count">{count}</span>
              </button>
            );
          })}
        </aside>

        <section>
          {filteredArticles.length === 0 ? (
            <EmptyState
              icon="📚"
              title={data.wikiArticles.length === 0 ? "The wiki is empty" : "No articles match"}
              text={
                data.wikiArticles.length === 0
                  ? isOwner
                    ? "Publish your first guide or study."
                    : "The owner has not published any articles yet."
                  : "Try a different search or category."
              }
            />
          ) : (
            <div className="wiki-grid">
              {filteredArticles.map((article) => {
                const category = data.wikiCategories.find((c) => c.id === article.categoryId);
                return (
                  <Link key={article.id} to={`/wiki/${article.id}`} className="wiki-card">
                    <small className="wiki-card__category">{category?.name ?? "Uncategorized"}</small>
                    <h3>{article.title}</h3>
                    <p>{article.summary}</p>
                    <div className="wiki-card__meta">
                      <span>Updated {formatDate(article.updatedAt)}</span>
                      <span>{data.actorName(article.authorId)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}