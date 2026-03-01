// File: studyshare/backend/src/controllers/uploadControllers.ts
// This file handles the upload logic for images to Supabase Storage.
//this file calls the uploadService to handle the actual upload process
import { Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { deleteFromStorageByPublicUrl, uploadToStorage, isValidImageType, isValidFileSize } from '../services/uploadService';

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE,
    files: 1,
  },
});

export const uploadSingleImage: RequestHandler = (req, res, next) => {
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

const validateUploadRequest = (req: Request, res: Response) => {
  const file = req.file;
  const user = req.user;

  if (!file) {
    res.status(400).json({ error: 'ファイルがアップロードされていません' });
    return null;
  }

  if (!user) {
    res.status(401).json({ error: '認証が必要です' });
    return null;
  }

  if (!isValidImageType(file.mimetype)) {
    res.status(400).json({ error: '無効なファイル形式です（png/jpg/webpのみ）' });
    return null;
  }
  if (!isValidFileSize(file.size)) {
    res.status(400).json({ error: 'ファイルサイズが大きすぎます（5MBまで）' });
    return null;
  }

  return { file, user };
};

/**
 * Validates and uploads an image file provided via multipart form data to Supabase Storage.
 *
 * @param req - Express request expected to contain a Multer `file` and the authenticated user context.
 * @param res - Express response used to return the uploaded image URL or an error message.
 * @returns A promise that resolves once the HTTP response has been sent.
 */
export const uploadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = validateUploadRequest(req, res);
    if (!validated) return;
    const { file, user } = validated;

    // Storageにアップロードして公開URLを取得
    const imageUrl = await uploadToStorage(file, user.id);

    res.status(200).json({ url: imageUrl });
  } catch (error: any) {
    console.error('アップロードコントローラーエラー:', error);
    res.status(500).json({ error: error.message || 'アップロード処理でエラーが発生しました' });
  }
};

export const uploadNoteImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = validateUploadRequest(req, res);
    if (!validated) return;
    const { file, user } = validated;

    const imageUrl = await uploadToStorage(file, user.id, 'notes');

    res.status(200).json({ url: imageUrl });
  } catch (error: any) {
    console.error('ノート画像アップロードコントローラーエラー:', error);
    res.status(500).json({ error: error.message || 'アップロード処理でエラーが発生しました' });
  }
};

export const uploadAvatarImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = validateUploadRequest(req, res);
    if (!validated) return;
    const { file, user } = validated;
    const previousUrl = typeof req.body?.previousUrl === 'string' ? req.body.previousUrl.trim() : '';

    const imageUrl = await uploadToStorage(file, user.id, 'avatars');
    if (previousUrl) {
      await deleteFromStorageByPublicUrl(previousUrl, user.id, 'avatars');
    }

    res.status(200).json({ url: imageUrl });
  } catch (error: any) {
    console.error('アバター画像アップロードコントローラーエラー:', error);
    res.status(500).json({ error: error.message || 'アップロード処理でエラーが発生しました' });
  }
};
