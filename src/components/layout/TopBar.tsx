import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../store/AppContext";
import { useData } from "../../store/DataContext";
import { ROLE_LABELS } from "../../data/types";
import { timeAgo } from "../../utils/format";
import { Icon } from "../ui/Icon";
import { Dropdown, DropdownItem } from "../ui/Dropdown";

interface SearchResult {
  category: string;
  label: string;
  detail?: string;
  path: string;
}

const SEARCH_CATEGORIES = [
  "All",
  "Properties",
  "Projects",
  "Tasks",
  "People",
  "Inventory",
  "Requests",
] as const;

export function TopBar() {
  const { user, toggleSidebar, signOut } = useApp();
  const data = useData();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof SEARCH_CATEGORIES)[number]>("All");
  const [showResults, setShowResults] = useState(false);

  const person = user ? data.personById(user.personId) : undefined;
  const myId = person?.id ?? "";

  const unreadNotifications = data.notifications.filter((n) => n.recipientId === myId && !n.read);
  const unreadMessages = data.conversations.filter(
    (c) =>
      c.participantIds.includes(myId) &&
      c.messages.some((m) => m.senderId !== myId && !m.readBy.includes(myId)),
  );

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const found: SearchResult[] = [];
    const want = (cat: string) => category === "All" || category === cat;

    if (want("Properties")) {
      data.properties
        .filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
        .forEach((p) =>
          found.push({ category: "Properties", label: p.name, detail: p.address, path: `/properties/${p.id}` }),
        );
    }
    if (want("Projects")) {
      data.projects
        .filter((p) => p.name.toLowerCase().includes(q))
        .forEach((p) =>
          found.push({
            category: "Projects",
            label: p.name,
            detail: data.propertyById(p.propertyId)?.name,
            path: `/projects/${p.id}`,
          }),
        );
    }
    if (want("Tasks")) {
      data.tasks
        .filter((t) => t.title.toLowerCase().includes(q))
        .forEach((t) =>
          found.push({ category: "Tasks", label: t.title, detail: t.status.replace("-", " "), path: "/tasks" }),
        );
    }
    if (want("People")) {
      data.people
        .filter((p) => p.kind !== "admin" && p.name.toLowerCase().includes(q))
        .forEach((p) =>
          found.push({
            category: "People",
            label: p.name,
            detail: p.title,
            path:
              p.kind === "builder"
                ? "/people/managers"
                : p.kind === "worker"
                  ? "/people/workers"
                  : p.kind === "developer"
                    ? "/people/developers"
                    : p.kind === "customer-service"
                      ? "/people/customer-service"
                      : "/people/owners",
          }),
        );
    }
    if (want("Inventory")) {
      data.inventory
        .filter((i) => i.name.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q))
        .forEach((i) => found.push({ category: "Inventory", label: i.name, detail: i.supplier, path: "/inventory" }));
    }
    if (want("Requests")) {
      data.requests
        .filter((r) => r.title.toLowerCase().includes(q))
        .forEach((r) =>
          found.push({
            category: "Requests",
            label: r.title,
            detail: r.status.replace("-", " "),
            path: r.kind === "problem" ? "/problems" : "/requests",
          }),
        );
    }
    return found.slice(0, 12);
  }, [query, category, data]);

  if (!user) return null;

  const handleSelect = (path: string) => {
    setQuery("");
    setShowResults(false);
    navigate(path);
  };

  return (
    <header className="topbar">
      <button className="topbar__menu-btn" onClick={toggleSidebar} aria-label="Toggle navigation menu">
        <Icon name="menu" size={16} />
      </button>

      <div className="topbar__search">
        <span className="topbar__search-icon">
          <Icon name="search" size={15} />
        </span>
        <input
          type="search"
          placeholder="Search properties, projects, tasks, people…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => query.trim().length >= 2 && setShowResults(true)}
          onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
          aria-label="Global search"
        />
        {showResults && query.trim().length >= 2 && (
          <div className="topbar__search-results">
            <div className="topbar__search-cats" role="tablist" aria-label="Search categories">
              {SEARCH_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  className={`topbar__search-cat ${category === cat ? "active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            {results.length === 0 ? (
              <div className="topbar__search-empty">No matches for “{query}”</div>
            ) : (
              Object.entries(
                results.reduce<Record<string, SearchResult[]>>((acc, r) => {
                  (acc[r.category] ??= []).push(r);
                  return acc;
                }, {}),
              ).map(([cat, items]) => (
                <div key={cat} className="topbar__search-group">
                  <div className="topbar__search-label">{cat}</div>
                  {items.map((item) => (
                    <button
                      key={`${item.category}-${item.label}`}
                      type="button"
                      className="topbar__search-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(item.path);
                      }}
                    >
                      <span className="topbar__search-item-label">{item.label}</span>
                      {item.detail && <span className="topbar__search-item-detail">{item.detail}</span>}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="topbar__quick-actions">
        <Link to="/messages" className="topbar__icon-btn" aria-label={`Messages (${unreadMessages.length} unread)`}>
          <Icon name="message" size={16} />
          {unreadMessages.length > 0 && <span className="topbar__badge">{unreadMessages.length}</span>}
        </Link>

        <Dropdown
          label="Notifications"
          trigger={
            <>
              <Icon name="bell" size={16} />
              {unreadNotifications.length > 0 && (
                <span className="topbar__badge topbar__badge--static">{unreadNotifications.length}</span>
              )}
            </>
          }
        >
          <div className="dropdown__header">Notifications</div>
          {unreadNotifications.length === 0 ? (
            <div className="dropdown__empty">You're all caught up.</div>
          ) : (
            unreadNotifications.slice(0, 5).map((n) => (
              <Link
                key={n.id}
                to={n.link ?? "/notifications"}
                className="dropdown__notif"
                onClick={() => {
                  /* Viewing a notification marks it read — badge count updates. */
                  data.markNotificationRead(n.id);
                }}
              >
                <span className="dropdown__notif-title">{n.title}</span>
                <span className="dropdown__notif-body">{n.body}</span>
                <span className="dropdown__notif-time">{timeAgo(n.createdAt)}</span>
              </Link>
            ))
          )}
          <div className="dropdown__footer">
            <Link to="/notifications" className="btn btn--ghost btn--sm">
              View all notifications
            </Link>
          </div>
        </Dropdown>

        <Dropdown
          label="Account menu"
          trigger={
            <>
              <span className="topbar__profile-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
              <span className="topbar__profile-name">{user.name}</span>
              <span className={`role-badge role-badge--${user.role}`}>{ROLE_LABELS[user.role]}</span>
            </>
          }
        >
          <div className="dropdown__account-header">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className={`role-badge role-badge--${user.role}`}>{ROLE_LABELS[user.role]}</span>
          </div>
          <DropdownItem icon={<Icon name="account" size={15} />} onClick={() => navigate("/account")}>
            Account
          </DropdownItem>
          <DropdownItem icon={<Icon name="settings" size={15} />} onClick={() => navigate("/settings")}>
            Settings
          </DropdownItem>
          <div className="dropdown__divider" />
          <DropdownItem icon={<Icon name="logout" size={15} />} danger onClick={signOut}>
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}