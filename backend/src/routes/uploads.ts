import { RequestHandler, Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { idempotencyGuard } from '../middleware/idempotency';
import { uploadAvatarImageController, uploadController, uploadNoteImageController } from '../controllers/uploadControllers';

const router = Router();
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE,
    files: 1,
  },
});
const enableLegacyUploadApi = process.env.ENABLE_LEGACY_UPLOAD_API === 'true';

const uploadSingleImage: RequestHandler = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'ファイルサイズが大きすぎます（5MBまで）' });
      return;
    }

    res.status(400).json({ error: 'ファイルアップロードに失敗しました' });
  });
};

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
