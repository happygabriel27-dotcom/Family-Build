import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";

interface NotFoundPageProps {
  title?: string;
}

export function NotFoundPage({ title = "Page not found" }: NotFoundPageProps) {
  return (
    <EmptyState
      icon="🔍"
      title={title}
      text="The page you're looking for doesn't exist or may have been moved."
      action={
        <Link to="/" className="btn btn--primary">
          Back to Overview
        </Link>
      }
    />
  );
}