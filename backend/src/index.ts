import "dotenv/config";
import http from "node:http";
import path from "node:path";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import "./db.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profiles.js";
import conversationRoutes from "./routes/conversations.js";
import messageRoutes from "./routes/messages.js";
import mediaRoutes from "./routes/media.js";
import { registerWsClient } from "./ws.js";

const port = Number(process.env.PORT ?? 5000);
const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGIN ?? "http://localhost:5173,http://localhost:8080")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  // Dev: any localhost port (Vite/Lovable often use 5173, 8080, etc.)
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.resolve(uploadDir)));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "neon-murmur-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/media", mediaRoutes);

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  registerWsClient(ws, token);
});

server.listen(port, () => {
  console.log(`ARCHIVE backend listening on http://localhost:${port}`);
});
