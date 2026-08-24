import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { timeAgo } from "../utils/format";

const TYPE_ICONS: Record<string, string> = {
  "task-assigned": "tasks",
  "task-completed": "check",
  "task-updated": "edit",
  "purchase-submitted": "purchasing",
  "purchase-approved": "check",
  "purchase-rejected": "x",
  "request-new": "clipboard",
  "request-update": "clipboard",
  "issue-reported": "alert",
  "issue-resolved": "check",
  message: "message",
  "project-update": "project",
  system: "bell",
};

export function NotificationsPage() {
  const { user } = useApp();
  const data = useData();

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";

  const mine = useMemo(
    () =>
      data.notifications
        .filter((n) => n.recipientId === myId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.notifications, myId],
  );

  const unread = mine.filter((n) => !n.read);

  /**
   * A notification becomes READ only when the individual item is actually
   * viewed/expanded — opening this page alone does NOT mark everything read.
   */
  const viewNotification = (id: string) => {
    const notification = data.notifications.find((n) => n.id === id);
    if (notification && !notification.read) data.markNotificationRead(id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Notifications</h1>
          <p className="page-header__subtitle">
            Business alerts — task assignments, approvals, requests, and messages.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            className="btn btn--secondary"
            disabled={unread.length === 0}
            onClick={() => {
              data.markAllNotificationsRead();
            }}
          >
            Mark all as read
          </button>
        </div>
      </div>

      {mine.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No notifications yet"
          text="Activity that involves you will show up here."
        />
      ) : (
        <ul className="notification-list">
          {mine.map((n) => (
            <li
              key={n.id}
              className={`notification-item ${n.read ? "" : "notification-item--unread"}`}
              onClick={() => viewNotification(n.id)}
              role={n.read ? undefined : "button"}
              title={n.read ? undefined : "Click to mark as read"}
              style={{ cursor: "pointer" }}
            >
              <span className="notification-item__icon">
                <Icon name={TYPE_ICONS[n.type] ?? "bell"} size={16} />
              </span>
              <div className="notification-item__body">
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <time>{timeAgo(n.createdAt)}</time>
              </div>
              <div className="notification-item__actions">
                {!n.read && (
                  <button className="btn btn--ghost btn--sm" onClick={() => data.markNotificationRead(n.id)}>
                    Mark read
                  </button>
                )}
                {n.link && (
                  <Link to={n.link} className="btn btn--ghost btn--sm">
                    Open
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}