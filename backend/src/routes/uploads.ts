import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { idempotencyGuard } from '../middleware/idempotency';
import { uploadAvatarImageController, uploadController, uploadNoteImageController } from '../controllers/uploadControllers';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 画像アップロード API
 * POST /api/upload
 */
router.post('/upload', authenticate, idempotencyGuard, upload.single('image'), uploadController);

/**
 * ノート画像アップロード API
 * POST /api/notes/upload
 */
router.post('/notes/upload', authenticate, idempotencyGuard, upload.single('image'), uploadNoteImageController);

/**
 * プロフィールのアバター画像アップロード API
 * POST /api/profiles/avatar/upload
 */
router.post('/profiles/avatar/upload', authenticate, idempotencyGuard, upload.single('image'), uploadAvatarImageController);

export default router;
