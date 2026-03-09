import { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { uploadFile, deleteFile } from '../utils/storage';

const prisma = new PrismaClient();
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const RESIZE_THRESHOLD = 2 * 1024 * 1024; // 2MB
const MAX_WIDTH = 1920;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function getUserId(req: Request): string {
  if (!req.user?.id) throw new Error('Unauthorized');
  return req.user.id;
}

const storage = multer.memoryStorage();
export const uploadScreenshotMulter = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_MIMES.includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only JPEG, PNG and WebP images are allowed'));
  },
});

export async function uploadScreenshot(req: Request, res: Response): Promise<void> {
  try {
    getUserId(req);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file || !file.buffer) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded. Use multipart/form-data with field "file".',
      });
      return;
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        error: 'Only JPEG, PNG and WebP are allowed.',
      });
      return;
    }

    let buffer = file.buffer;
    if (buffer.length > RESIZE_THRESHOLD) {
      buffer = await sharp(buffer)
        .resize(MAX_WIDTH, null, { withoutEnlargement: true })
        .toBuffer();
    }

    const url = await uploadFile(buffer, file.originalname || 'screenshot.jpg', file.mimetype);
    res.json({ success: true, data: { url } });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
      return;
    }
    if (err instanceof Error && err.message === 'Only JPEG, PNG and WebP images are allowed') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    console.error('uploadScreenshot error', err);
    res.status(500).json({ success: false, error: 'Failed to upload screenshot.' });
  }
}

export async function deleteScreenshot(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const url = (req.body as { url?: string })?.url;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'Missing url in body.' });
      return;
    }

    await deleteFile(url);

    await prisma.trade.updateMany({
      where: { userId, screenshotUrl: url },
      data: { screenshotUrl: null },
    });

    res.json({ success: true, data: { message: 'Screenshot deleted.' } });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    console.error('deleteScreenshot error', err);
    res.status(500).json({ success: false, error: 'Failed to delete screenshot.' });
  }
}
