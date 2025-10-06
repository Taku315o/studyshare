
//uploadController.ts
// Supabase Storageへのファイルアップロードに関するロジックを実装している。
// uuidv4でユニークなファイル名を生成し、ファイルをストレージにアップロード後、公開URLを返却する。


import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { supabaseAdmin as supabase } from '../lib/supabase';

// multerの型定義を修正
// ファイル型の定義を変更
interface File {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// ファイルのMIMEタイプチェック
export const isValidImageType = (mimetype: string): boolean => {
  return ['image/jpeg', 'image/png'].includes(mimetype);
};

// ファイルサイズチェック (5MB)
export const isValidFileSize = (size: number): boolean => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  return size <= MAX_FILE_SIZE;
};

// Supabase Storageへのアップロード
export const uploadToStorage = async (
  file: File,
  userId: string
): Promise<string> => {
  try {
    // ファイル名を固有のIDに変更
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // バケット名
    const bucketName = 'assignments';
    
    // Supabase Storageにアップロード
    const { error: uploadError, data } = await supabase.storage
      .from(bucketName)
      .upload(`${userId}/${fileName}`, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('アップロードエラー:', uploadError);
      throw new Error('ファイルのアップロードに失敗しました');
    }
    
    // 公開URLを生成
    const { data: publicURL } = supabase.storage
      .from(bucketName)
      .getPublicUrl(`${userId}/${fileName}`);
    
    return publicURL.publicUrl;
  } catch (error) {
    console.error('ストレージエラー:', error);
    throw new Error('ファイルのアップロード処理に失敗しました');
  }
};
