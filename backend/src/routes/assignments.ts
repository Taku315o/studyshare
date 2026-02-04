// backend/src/routes/assignments.ts

import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../middleware/auth'; // 作成したミドルウェア
import validate from '../middleware/validate';
import { createAssignmentSchema } from '../validators/assignment';
import { 
  createAssignmentController, 
  searchAssignmentsController, 
  deleteAssignmentController 
} from '../controllers/assignmentController';
import { uploadController } from '../controllers/uploadControllers';
/**
 * Express router exposing assignment CRUD endpoints and image upload handling.
 */
const router = Router();

// Multerの設定（画像をメモリ上に保存）
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 課題一覧取得・検索 API
 * GET /api/assignments/search?query=...
 */
router.get('/assignments/search', searchAssignmentsController);

/**
 * 画像アップロード API
 * POST /api/upload
 */
router.post('/upload', authenticate, upload.single('image'), uploadController);


/**
 * 課題投稿 API
 * POST /api/assignments
 */
router.post(
  '/assignments',
  authenticate,
  validate(createAssignmentSchema),
  createAssignmentController
);

/**
 * 課題削除 API (管理者用)
 * DELETE /api/assignments/:id
 */
router.delete('/assignments/:id', authenticate, requireAdmin, deleteAssignmentController);

export default router;
