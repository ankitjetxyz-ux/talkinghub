import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../auth.js";

const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    cb(null, ok);
  },
});

const router = Router();

router.post("/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Image or video file required" });
    return;
  }

  const baseUrl = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 5000}`;
  const url = `${baseUrl}/uploads/${req.file.filename}`;

  res.json({
    url,
    media_type: req.file.mimetype,
    filename: req.file.filename,
  });
});

export default router;
