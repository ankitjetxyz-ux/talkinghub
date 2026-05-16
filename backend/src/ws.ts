import type { WebSocket } from "ws";
import { verifyToken } from "./auth.js";

type Client = { ws: WebSocket; userId: string };

const clients = new Set<Client>();

export function registerWsClient(ws: WebSocket, token: string | null) {
  if (!token) {
    ws.close(4001, "Unauthorized");
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    ws.close(4001, "Unauthorized");
    return;
  }

  const client: Client = { ws, userId: user.id };
  clients.add(client);

  ws.on("close", () => clients.delete(client));
  ws.on("error", () => clients.delete(client));

  ws.send(JSON.stringify({ type: "connected", userId: user.id }));
}

export function broadcast(event: string, payload: unknown, filter?: (c: Client) => boolean) {
  const msg = JSON.stringify({ type: event, payload });
  for (const c of clients) {
    if (c.ws.readyState !== 1) continue;
    if (filter && !filter(c)) continue;
    c.ws.send(msg);
  }
}

export function notifyConversationMembers(
  memberIds: string[],
  event: string,
  payload: unknown,
) {
  const set = new Set(memberIds);
  broadcast(event, payload, (c) => set.has(c.userId));
}

/** Deliver an event only to sockets for the listed user ids (e.g. profile avatar updated). */
export function notifyMemberIds(memberIds: string[], event: string, payload: unknown) {
  const set = new Set(memberIds);
  broadcast(event, payload, (c) => set.has(c.userId));
}
