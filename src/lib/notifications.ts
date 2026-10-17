import type { Notification } from "@/types";

/**
 * Single source of truth for notification type grouping and filtering.
 *
 * The notifications page used to inline this logic; keeping it here means the
 * page (and any future consumer) shares one implementation instead of
 * duplicating it.
 */

export const TYPE_GROUPS: Record<string, string> = {
  contribution: "Contributions",
  contribution_received: "Contributions",
  payout: "Payouts",
  payout_received: "Payouts",
  circle: "Circles",
  circle_joined: "Circles",
  circle_completed: "Circles",
  transfer_confirmed: "Transfers",
  transfer_failed: "Transfers",
  transfer_received: "Transfers",
  system: "System",
  warning: "Alerts",
  penalty: "Alerts",
};

export const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "contribution", label: "Contributions" },
  { value: "payout", label: "Payouts" },
  { value: "circle", label: "Circles" },
  { value: "transfer", label: "Transfers" },
  { value: "system", label: "System" },
  { value: "warning", label: "Alerts" },
] as const;

export function groupForType(type: string): string {
  return TYPE_GROUPS[type] ?? "Other";
}

export function filterNotifications(
  notifications: Notification[],
  filter: "all" | "unread",
  typeFilter: string
): Notification[] {
  let result = notifications;
  if (filter === "unread") {
    result = result.filter((n) => !n.isRead);
  }
  if (typeFilter !== "all") {
    result = result.filter((n) => {
      const group = groupForType(n.type);
      return (
        group.toLowerCase() === typeFilter || n.type.startsWith(typeFilter)
      );
    });
  }
  return result;
}

export function groupNotificationsByType(
  notifications: Notification[]
): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const groupKey = groupForType(n.type);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(n);
  }
  return groups;
}
