// File: studyshare/backend/src/controllers/uploadControllers.ts
// This file handles the upload logic for images to Supabase Storage.
//this file calls the uploadService to handle the actual upload process
import { Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import {
  createSignedUrlForStoredObject,
  deleteFromStorageByPublicUrl,
  uploadToStorage,
  isValidImageType,
  isValidFileSize,
  StorageReferenceError,
  StorageUploadError,
  STORAGE_UPLOAD_ERROR_CODE,
} from '../services/uploadService';
import { supabaseFromToken } from '../lib/supabase';

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const FILE_TOO_LARGE_ERROR_CODE = 'FILE_TOO_LARGE' as const;
const FILE_TOO_LARGE_ERROR_MESSAGE = 'ファイルサイズが大きすぎます（5MBまで）';

const sendFileTooLargeError = (res: Response): void => {
  res.status(413).json({
    code: FILE_TOO_LARGE_ERROR_CODE,
    error: FILE_TOO_LARGE_ERROR_MESSAGE,
  });
};

const sendStorageUploadError = (res: Response): void => {
  res.status(503).json({
    code: STORAGE_UPLOAD_ERROR_CODE,
    error: 'ストレージへのアップロードに失敗しました。時間をおいて再度お試しください。',
  });
};

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
      sendFileTooLargeError(res);
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
    sendFileTooLargeError(res);
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
    if (error instanceof StorageUploadError) {
      sendStorageUploadError(res);
      return;
    }
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
    if (error instanceof StorageUploadError) {
      sendStorageUploadError(res);
      return;
    }
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
    if (error instanceof StorageUploadError) {
      sendStorageUploadError(res);
      return;
    }
    res.status(500).json({ error: error.message || 'アップロード処理でエラーが発生しました' });
  }
};

export const getNoteImageUrlController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    const noteId = typeof req.params.noteId === 'string' ? req.params.noteId.trim() : '';
    if (!noteId) {
      res.status(400).json({ error: 'noteId が不正です' });
      return;
    }

    const supabase = supabaseFromToken(req.authToken);
    const { data: note, error } = await supabase
      .from('notes')
      .select('id, image_url')
      .eq('id', noteId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !note?.image_url) {
      res.status(404).json({ error: '画像が見つかりません' });
      return;
    }

    const signedUrl = await createSignedUrlForStoredObject(note.image_url);
    res.status(200).json({ url: signedUrl });
  } catch (error: any) {
    console.error('ノート画像URL取得エラー:', error);
    if (error instanceof StorageReferenceError) {
      res.status(404).json({ error: '画像が見つかりません' });
      return;
    }
    if (error instanceof StorageUploadError) {
      sendStorageUploadError(res);
      return;
    }
    res.status(500).json({ error: error.message || '画像URLの取得に失敗しました' });
  }
};
