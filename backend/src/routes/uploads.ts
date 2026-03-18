import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { idempotencyGuard } from '../middleware/idempotency';
import {
  getNoteImageUrlController,
  uploadAvatarImageController,
  uploadController,
  uploadNoteImageController,
  uploadSingleImage,
} from '../controllers/uploadControllers';

type CreateUploadRoutesOptions = {
  enableLegacyUploadApi?: boolean;
};

export const createUploadRoutes = (options: CreateUploadRoutesOptions = {}) => {
  const router = Router();
  const enableLegacyUploadApi =
    options.enableLegacyUploadApi ?? process.env.ENABLE_LEGACY_UPLOAD_API === 'true';

  /**
   * 画像アップロード API
   * POST /api/upload
   */
  if (enableLegacyUploadApi) {
    router.post('/upload', authenticate, idempotencyGuard, uploadSingleImage, uploadController);
  }

  /**
   * ノート画像表示用 signed URL 取得 API
   * GET /api/notes/:noteId/image-url
   */
  router.get('/notes/:noteId/image-url', authenticate, getNoteImageUrlController);

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

  return router;
};

const uploadRoutes = createUploadRoutes();

export default uploadRoutes;
