import type { ReactNode } from "react";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

const toneMap: Record<string, BadgeTone> = {
  // generic / legacy
  active: "success",
  completed: "success",
  approved: "success",
  resolved: "success",
  done: "success",
  delivered: "success",
  ready: "success",
  inactive: "neutral",
  archived: "neutral",
  draft: "neutral",
  pending: "warning",
  "in-progress": "info",
  "on-hold": "warning",
  open: "warning",
  rejected: "danger",
  todo: "neutral",
  // tasks
  "not-started": "neutral",
  blocked: "danger",
  cancelled: "neutral",
  // priorities
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
  // requests
  submitted: "warning",
  "under-review": "info",
  assigned: "info",
  waiting: "warning",
  closed: "neutral",
  // inventory
  "in-stock": "success",
  "low-stock": "warning",
  "out-of-stock": "danger",
};

export function statusTone(status: string): BadgeTone {
  return toneMap[status] ?? "neutral";
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status.replace(/-/g, " ")}</Badge>;
}