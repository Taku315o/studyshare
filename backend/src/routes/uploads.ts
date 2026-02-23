import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { uploadController, uploadNoteImageController } from '../controllers/uploadControllers';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 画像アップロード API
 * POST /api/upload
 */
router.post('/upload', authenticate, upload.single('image'), uploadController);

/**
 * ノート画像アップロード API
 * POST /api/notes/upload
 */
router.post('/notes/upload', authenticate, upload.single('image'), uploadNoteImageController);

export default router;
