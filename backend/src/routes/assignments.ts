// backend/src/routes/assignments.ts

import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin as supabase } from '../lib/supabase';
import { authenticate, requireAdmin } from '../middleware/auth'; // 作成したミドルウェア
import validate from '../middleware/validate';
import { createAssignmentSchema } from '../validators/assignment';

const router = Router();

// Multerの設定（画像をメモリ上に保存）
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 課題一覧取得・検索 API
 * GET /api/assignments/search?query=...
 */
router.get('/assignments/search', async (req, res) => {
  const query = req.query.query as string;

  try {
    const { data, error } = await supabase.rpc('search_assignments', { search_query: query });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: '課題の検索に失敗しました。', error });
  }
});

/**
 * 画像アップロード API
 * POST /api/upload
 */
router.post('/upload', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: '画像ファイルがありません。' });
    return;
  }

  // @ts-ignore
  const userId = req.user.id;
  const file = req.file;
  const fileName = `${userId}/${Date.now()}_${file.originalname}`;

  try {
    const { data, error } = await supabase.storage
      .from('assignments') // Supabase Storageのバケット名
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) throw error;
    
    // 公開URLを取得
    const { data: { publicUrl } } = supabase.storage.from('assignments').getPublicUrl(fileName);
    
    res.json({ url: publicUrl });
  } catch (error) {
    res.status(500).json({ message: '画像のアップロードに失敗しました。', error });
  }
});


/**
 * 課題投稿 API
 * POST /api/assignments
 */
router.post('/assignments', authenticate, validate(createAssignmentSchema), async (req, res) => {
  const { title, description, image_url } = req.body;
  // @ts-ignore
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert({ title, description, image_url, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: '課題の投稿に失敗しました。', error });
  }
});

/**
 * 課題削除 API (管理者用)
 * DELETE /api/assignments/:id
 */
router.delete('/assignments/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw error;
    res.status(204).send(); // No Content
  } catch (error) {
    res.status(500).json({ message: '課題の削除に失敗しました。', error });
  }
});

export default router;
