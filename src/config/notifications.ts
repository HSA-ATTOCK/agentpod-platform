/** Emails Baba can send about tasks, and whether each is on by default. */
export const notificationEvents = [
  { key: "task_finished", label: "Task finished", description: "When Baba finishes a task you started.", defaultOn: false },
  { key: "task_failed", label: "Task failed", description: "When a task you started couldn't finish.", defaultOn: true },
  { key: "paused_at_cap", label: "Paused at spending cap", description: "When your task pauses and needs Continue.", defaultOn: true },
  { key: "approval_needed", label: "Approval needed", description: "When Baba is waiting for your OK.", defaultOn: true },
] as const;

export type NotificationKey = (typeof notificationEvents)[number]["key"];
export type NotificationPrefs = Partial<Record<string, { email?: boolean }>>;

export function emailEnabled(prefs: NotificationPrefs, key: NotificationKey) {
  const choice = prefs[key]?.email;
  return choice ?? notificationEvents.find((e) => e.key === key)!.defaultOn;
}
