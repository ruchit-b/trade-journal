import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import {
  uploadScreenshotMulter,
  uploadScreenshot,
  deleteScreenshot,
} from '../controllers/uploads.controller';

const router = Router();

router.use(authMiddleware);

router.post(
  '/screenshot',
  (req: Request, res: Response, next: NextFunction) => {
    uploadScreenshotMulter.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
          return;
        }
        if (err instanceof Error && err.message === 'Only JPEG, PNG and WebP images are allowed') {
          res.status(400).json({ success: false, error: err.message });
          return;
        }
        return next(err);
      }
      void uploadScreenshot(req, res).catch(next);
    });
  }
);

router.delete('/screenshot', deleteScreenshot);

export default router;
