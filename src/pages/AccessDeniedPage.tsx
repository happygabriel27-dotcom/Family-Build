import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { ROLE_LABELS } from "../data/types";
import { EmptyState } from "../components/ui/EmptyState";

/** Shown when a user reaches a URL their role is not permitted to access. */
export function AccessDeniedPage() {
  const { user } = useApp();

  return (
    <EmptyState
      icon="🔒"
      title="Access restricted"
      text={
        user
          ? `Your role (${ROLE_LABELS[user.role]}) does not have permission to view this page. If you believe this is a mistake, contact the Owner.`
          : "You do not have permission to view this page."
      }
      action={
        <Link to="/" className="btn btn--primary">
          Back to Overview
        </Link>
      }
    />
  );
}