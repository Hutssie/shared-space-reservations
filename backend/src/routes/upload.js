import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'));
  },
});

router.post('/', authMiddleware, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  } catch (e) {
    next(e);
  }
});

router.post('/multiple', authMiddleware, upload.array('files', 10), (req, res, next) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const base = `${req.protocol}://${req.get('host')}`;
    const urls = files.map((f) => `${base}/uploads/${f.filename}`);
    res.status(201).json({ urls });
  } catch (e) {
    next(e);
  }
});

export const uploadRouter = router;
