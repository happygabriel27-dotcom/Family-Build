import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useApp } from "../../store/AppContext";
import { useData } from "../../store/DataContext";
import { NAV_BY_ROLE } from "../../data/navConfig";
import { isNavGroup } from "../../data/types";
import { navBadgeCounts, type NavBadge } from "../../data/calculations";
import { Icon } from "../ui/Icon";
import { BrandMark } from "../ui/BrandMark";

export function Sidebar() {
  const { user, sidebarOpen, sidebarCollapsed, toggleCollapsed, closeSidebar } = useApp();
  const data = useData();
  const [openGroups, setOpenGroups] = useState<string[]>(["People"]);

  if (!user) return null;

  const sections = NAV_BY_ROLE[user.role];

  /* Live indicators recomputed whenever any underlying data changes. */
  const badges = useMemo(
    () =>
      navBadgeCounts({
        user,
        people: data.people,
        tasks: data.tasks,
        requests: data.requests,
        purchaseOrders: data.purchaseOrders,
        inventory: data.inventory,
        inventoryTransactions: data.inventoryTransactions,
        conversations: data.conversations,
        notifications: data.notifications,
        suggestions: data.suggestions,
      }),
    [user, data],
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  const renderBadge = (badge: NavBadge | undefined) => {
    if (!badge) return null;
    if (badge.dot) {
      return <span className="nav-item__dot" title="Needs attention" aria-label="Needs attention" />;
    }
    if (badge.count && badge.count > 0) {
      return <span className="nav-item__badge">{badge.count > 99 ? "99+" : badge.count}</span>;
    }
    return null;
  };

  const renderLeaf = (leaf: { label: string; path: string; icon: string; indicator?: "count" | "dot" }) => {
    const badge = leaf.indicator ? badges[leaf.path] : undefined;
    return (
      <NavLink
        key={leaf.path}
        to={leaf.path}
        end={leaf.path === "/"}
        className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        onClick={closeSidebar}
        title={sidebarCollapsed ? leaf.label : undefined}
      >
        <span className="nav-item__icon">
          <Icon name={leaf.icon} size={16} />
        </span>
        {!sidebarCollapsed && <span className="nav-item__label">{leaf.label}</span>}
        {!sidebarCollapsed && renderBadge(badge)}
        {sidebarCollapsed && badge && <span className="nav-item__badge nav-item__badge--floating">{renderBadgeInner(badge)}</span>}
      </NavLink>
    );
  };

  function renderBadgeInner(badge: NavBadge): string {
    if (badge.dot) return "●";
    return badge.count && badge.count > 0 ? String(badge.count > 99 ? "99+" : badge.count) : "";
  }

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      <aside
        className={`sidebar ${sidebarCollapsed ? "sidebar--collapsed" : ""} ${sidebarOpen ? "sidebar--open" : ""}`}
        aria-label="Main navigation"
      >
        {/* Brand lockup comes from the centralized website settings. */}
        <div className="sidebar__brand">
          {/* Slightly larger mark than before (30 → 34) — no layout shift. */}
          <BrandMark showText={!sidebarCollapsed} markSize={34} />
        </div>

        <nav className="sidebar__nav">
          {sections.map((section) => (
            <div
              key={section.label}
              className={`sidebar__section ${section.label !== "Main" ? "sidebar__section--bottom" : ""}`}
            >
              {!sidebarCollapsed && <div className="sidebar__label">{section.label}</div>}
              {section.entries.map((entry) => {
                if (!isNavGroup(entry)) return renderLeaf(entry);
                const expanded = openGroups.includes(entry.label);
                return (
                  <div key={entry.label} className="nav-group">
                    <button
                      type="button"
                      className={`nav-item nav-group__toggle ${expanded ? "nav-group__toggle--open" : ""}`}
                      onClick={() => toggleGroup(entry.label)}
                      aria-expanded={expanded}
                      title={sidebarCollapsed ? entry.label : undefined}
                    >
                      <span className="nav-item__icon">
                        <Icon name={entry.icon} size={16} />
                      </span>
                      {!sidebarCollapsed && (
                        <>
                          <span className="nav-item__label">{entry.label}</span>
                          <span className="nav-group__chevron">
                            <Icon name={expanded ? "chevronDown" : "chevronRight"} size={13} />
                          </span>
                        </>
                      )}
                    </button>
                    {expanded && !sidebarCollapsed && (
                      <div className="nav-group__children">{entry.children.map(renderLeaf)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__profile">
            <div className="sidebar__profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            {!sidebarCollapsed && (
              <div className="sidebar__profile-meta">
                <span>{user.name}</span>
                <small>{user.title}</small>
              </div>
            )}
          </div>

          <button className="sidebar__collapse-btn" onClick={toggleCollapsed}>
            <span className="nav-item__icon">
              <Icon name={sidebarCollapsed ? "chevronRight" : "arrowLeft"} size={16} />
            </span>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}