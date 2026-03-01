import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { idempotencyGuard } from '../middleware/idempotency';
import {
  uploadAvatarImageController,
  uploadController,
  uploadNoteImageController,
  uploadSingleImage,
} from '../controllers/uploadControllers';

const router = Router();
const enableLegacyUploadApi = process.env.ENABLE_LEGACY_UPLOAD_API === 'true';

/**
 * 画像アップロード API
 * POST /api/upload
 */
if (enableLegacyUploadApi) {
	router.post('/upload', authenticate, idempotencyGuard, uploadSingleImage, uploadController);
}

/**
 * ノート画像アップロード API
 * POST /api/notes/upload
 */
router.post('/notes/upload', authenticate, idempotencyGuard, uploadSingleImage, uploadNoteImageController);

/**
 * プロフィールのアバター画像アップロード API
 * POST /api/profiles/avatar/upload
 */
router.post('/profiles/avatar/upload', authenticate, idempotencyGuard, uploadSingleImage, uploadAvatarImageController);

export default router;
