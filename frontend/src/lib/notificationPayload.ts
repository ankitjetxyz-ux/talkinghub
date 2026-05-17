import type { ArchiveNotification } from "./notifications";

const notificationTemplates = [
  { top: "SYSTEM TRACE ACTIVE", bottom: "SESSION MAINTAINED" },
  { top: "ARCHIVE UPDATED", bottom: "SIGNAL STABLE" },
  { top: "NODE SYNCHRONIZED", bottom: "TRACE COMPLETE" },
  { top: "TRANSMISSION RECEIVED", bottom: "CHANNEL OPEN" },
  { top: "SIGNAL LOCKED", bottom: "ARCHIVE SYNCED" },
] as const;

export function buildNotificationPayload(
  originalMessage: string,
): ArchiveNotification {
  const { top, bottom } =
    notificationTemplates[
      Math.floor(Math.random() * notificationTemplates.length)
    ]!;
  return { top, message: originalMessage, bottom };
}
