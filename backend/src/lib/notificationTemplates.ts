export const notificationTemplates = [
  { top: "SYSTEM TRACE ACTIVE", bottom: "SESSION MAINTAINED" },
  { top: "ARCHIVE UPDATED", bottom: "SIGNAL STABLE" },
  { top: "NODE SYNCHRONIZED", bottom: "TRACE COMPLETE" },
  { top: "TRANSMISSION RECEIVED", bottom: "CHANNEL OPEN" },
  { top: "SIGNAL LOCKED", bottom: "ARCHIVE SYNCED" },
] as const;

export type NotificationPayload = {
  top: string;
  message: string;
  bottom: string;
};

export function pickNotificationTemplate() {
  return notificationTemplates[Math.floor(Math.random() * notificationTemplates.length)];
}

export function buildNotificationPayload(originalMessage: string): NotificationPayload {
  const { top, bottom } = pickNotificationTemplate();
  return { top, message: originalMessage, bottom };
}

/** Legacy string for clients that expect newlines */
export function buildNotificationBody(originalMessage: string): string {
  const { top, message, bottom } = buildNotificationPayload(originalMessage);
  return `${top}\n${message}\n${bottom}`;
}
