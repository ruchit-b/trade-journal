import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { upload, previewImport, confirmImport, getImports } from '../controllers/import.controller';

const router = Router();

router.use(authMiddleware);

function handleMulterError(err: unknown, res: Response, next: NextFunction): boolean {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
    return true;
  }
  if (err instanceof Error && err.message === 'Only CSV files are allowed') {
    res.status(400).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

router.post('/preview', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err && handleMulterError(err, res, next)) return;
    if (err) return next(err);
    previewImport(req, res);
  });
});

router.post('/confirm', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err && handleMulterError(err, res, next)) return;
    if (err) return next(err);
    confirmImport(req, res);
  });
});

router.get('/history', getImports);

export default router;
