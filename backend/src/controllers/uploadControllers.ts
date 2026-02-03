// File: studyshare/backend/src/controllers/uploadControllers.ts
// This file handles the upload logic for images to Supabase Storage.
//this file calls the uploadService to handle the actual upload process
import { Request, Response } from 'express';
import { uploadToStorage, isValidImageType, isValidFileSize } from '../services/uploadService';

/**
 * Validates and uploads an image file provided via multipart form data to Supabase Storage.
 *
 * @param req - Express request expected to contain a Multer `file` and the authenticated user context.
 * @param res - Express response used to return the uploaded image URL or an error message.
 * @returns A promise that resolves once the HTTP response has been sent.
 */
export const uploadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const user = req.user;

    if (!file) {
      res.status(400).json({ error: 'ファイルがアップロードされていません' });
      return;
    }

    if (!user) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    // ファイル形式とサイズのバリデーション
    if (!isValidImageType(file.mimetype)) {
      res.status(400).json({ error: '無効なファイル形式です（png/jpgのみ）' });
      return;
    }
    if (!isValidFileSize(file.size)) {
      res.status(400).json({ error: 'ファイルサイズが大きすぎます（5MBまで）' });
      return;
    }

    // Storageにアップロードして公開URLを取得
    const imageUrl = await uploadToStorage(file, user.id);

    res.status(200).json({ url: imageUrl });
  } catch (error: any) {
    console.error('アップロードコントローラーエラー:', error);
    res.status(500).json({ error: error.message || 'アップロード処理でエラーが発生しました' });
  }
};