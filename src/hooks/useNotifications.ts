import { useEffect, useRef } from "react";

export type NotificationSupport = "unsupported" | "default" | "granted" | "denied";

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationSupport;
}

/**
 * Asks for notification permission. Called only from an explicit user opt-in —
 * never on load — so the prompt always arrives with a reason attached.
 */
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (getNotificationSupport() === "unsupported") return "unsupported";
  if (Notification.permission !== "default") {
    return Notification.permission as NotificationSupport;
  }
  return (await Notification.requestPermission()) as NotificationSupport;
}

/**
 * Sends a browser notification when a session ends while the tab is hidden.
 *
 * The hidden check avoids double-alerting: the in-page chime and celebration
 * already cover the visible case. Nothing fires unless the user opted in and
 * the browser granted permission.
 *
 * @param enabled  User opt-in from preferences.
 * @param endedAt  Timestamp of the completion, or `null` when none is pending.
 *                 A new timestamp is what triggers a notification.
 * @param body     Text to show for that completion.
 */
export function useNotifications(
  enabled: boolean,
  endedAt: number | null,
  body: string,
) {
  const sentRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || endedAt === null) return;
    if (sentRef.current === endedAt) return;
    if (getNotificationSupport() !== "granted") return;
    if (!document.hidden) return;

    sentRef.current = endedAt;
    new Notification("Focube", { body, icon: "/favicon.svg" });
  }, [enabled, endedAt, body]);
}
