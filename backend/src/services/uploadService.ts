import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin as supabase } from '../lib/supabase';

interface File {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

type UploadTarget = 'assignments' | 'notes' | 'avatars';

const resolveBucketName = (target: UploadTarget): string => {
  if (target === 'avatars') {
    return (
      process.env.SUPABASE_AVATARS_IMAGE_BUCKET ||
      process.env.SUPABASE_STORAGE_BUCKET ||
      'avatars'
    );
  }

  if (target === 'notes') {
    return (
      process.env.SUPABASE_NOTES_IMAGE_BUCKET ||
      process.env.SUPABASE_STORAGE_BUCKET ||
      'notes'
    );
  }

  return (
    process.env.SUPABASE_ASSIGNMENTS_IMAGE_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    'assignments'
  );
};

const resolveObjectPath = (target: UploadTarget, userId: string, fileName: string): string => {
  if (target === 'notes') {
    return `notes/${userId}/${fileName}`;
  }

  if (target === 'avatars') {
    return `avatars/${userId}/${fileName}`;
  }

  return `${userId}/${fileName}`;
};

/**
 * Determines whether the provided MIME type is an accepted image format.
 *
 * @param mimetype - MIME type string reported for an uploaded file.
 * @returns True when the MIME type is JPEG, PNG, or WebP; otherwise false.
 */
export const isValidImageType = (mimetype: string): boolean => {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype);
};

/**
 * Validates that the file size does not exceed the allowed upload limit.
 *
 * @param size - Size of the file in bytes.
 * @returns True when the file is 5MB or smaller; otherwise false.
 */
export const isValidFileSize = (size: number): boolean => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  return size <= MAX_FILE_SIZE;
};

/**
 * Uploads an image to the specified Supabase Storage bucket
 * ('assignments', 'notes', or 'avatars') and returns its public URL.
 *
 * @param file - Multer file object containing the binary data to store.
 * @param userId - Identifier of the user whose namespace the file should be stored under.
 * @param target - The target bucket: 'assignments', 'notes', or 'avatars'.
 * @returns The publicly accessible URL pointing to the uploaded asset.
 * @throws When Supabase fails to upload the file or generate a public URL.
 */
export const uploadToStorage = async (file: File, userId: string, target: UploadTarget = 'assignments'): Promise<string> => {
  try {
    const fileExtension = file.originalname.split('.').pop() ?? 'bin';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const bucketName = resolveBucketName(target);
    const objectPath = resolveObjectPath(target, userId, fileName);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('アップロードエラー:', {
        bucketName,
        objectPath,
        message: uploadError.message,
      });
      throw new Error('ファイルのアップロードに失敗しました');
    }

    const { data: publicURL } = supabase.storage
      .from(bucketName)
      .getPublicUrl(objectPath);

    return publicURL.publicUrl;
  } catch (error) {
    console.error('ストレージエラー:', error);
    throw new Error('ファイルのアップロード処理に失敗しました');
  }
};
