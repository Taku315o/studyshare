import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin as supabase } from '../lib/supabase';

interface File {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

type UploadTarget = 'assignments' | 'notes' | 'avatars';
export const STORAGE_UPLOAD_ERROR_CODE = 'STORAGE_UPLOAD_FAILED' as const;
const SIGNED_URL_TTL_SECONDS = 60 * 10;

type StorageObjectReference = {
  bucketName: string;
  objectPath: string;
};

export class StorageUploadError extends Error {
  readonly code = STORAGE_UPLOAD_ERROR_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'StorageUploadError';
  }
}

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

// For better organization, we store files in subfolders based on the user ID and target type.
const resolveObjectPath = (target: UploadTarget, userId: string, fileName: string): string => {
  if (target === 'notes') {
    return `notes/${userId}/${fileName}`;
  }

  if (target === 'avatars') {
    return `avatars/${userId}/${fileName}`;
  }

  return `${userId}/${fileName}`;
};

// When deleting by public URL, we want to ensure that only files within the expected user-specific path are deleted.
const resolveExpectedPrefix = (target: UploadTarget, userId: string): string => {
  if (target === 'notes') return `notes/${userId}/`;
  if (target === 'avatars') return `avatars/${userId}/`;
  return `${userId}/`;
};

// Given a public URL, extract the object path if it belongs to the specified bucket. This is necessary because Supabase's public URLs do not directly expose the object path.
const resolveObjectPathFromPublicUrl = (publicUrl: string, bucketName: string): string | null => {
  try {
    const parsed = new URL(publicUrl);
    const markers = [
      `/storage/v1/object/public/${bucketName}/`,
      `/storage/v1/object/sign/${bucketName}/`,
    ];

    for (const marker of markers) {
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex < 0) {
        continue;
      }

      const encodedPath = parsed.pathname.slice(markerIndex + marker.length);
      if (!encodedPath) return null;

      return decodeURIComponent(encodedPath);
    }
  } catch {
    return null;
  }

  return null;
};

export const createStorageObjectReference = (bucketName: string, objectPath: string): string =>
  `storage://${bucketName}/${objectPath}`;

export const parseStorageObjectReference = (value: string): StorageObjectReference | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('storage://')) {
    const withoutScheme = trimmed.slice('storage://'.length);
    const firstSlashIndex = withoutScheme.indexOf('/');
    if (firstSlashIndex <= 0) {
      return null;
    }

    const bucketName = withoutScheme.slice(0, firstSlashIndex);
    const objectPath = withoutScheme.slice(firstSlashIndex + 1);
    if (!bucketName || !objectPath) {
      return null;
    }

    return { bucketName, objectPath };
  }

  try {
    const parsed = new URL(trimmed);
    const pathSegments = parsed.pathname.split('/');
    const publicIndex = pathSegments.indexOf('public');
    const signIndex = pathSegments.indexOf('sign');
    const bucketIndex = publicIndex >= 0 ? publicIndex + 1 : signIndex >= 0 ? signIndex + 1 : -1;

    if (bucketIndex < 0 || bucketIndex >= pathSegments.length) {
      return null;
    }

    const bucketName = pathSegments[bucketIndex];
    const objectPath = resolveObjectPathFromPublicUrl(trimmed, bucketName);
    if (!bucketName || !objectPath) {
      return null;
    }

    return { bucketName, objectPath };
  } catch {
    return null;
  }
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
 * Uploads an image to the specified Supabase Storage bucket and returns
 * a persisted reference string. Notes use a private storage reference,
 * while public buckets keep returning public URLs for backward compatibility.
 *
 * @param file - Multer file object containing the binary data to store.
 * @param userId - Identifier of the user whose namespace the file should be stored under.
 * @param target - The target bucket: 'assignments', 'notes', or 'avatars'.
 * @returns A persisted URL/reference string suitable for DB storage.
 * @throws When Supabase fails to upload the file or generate the return value.
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
      throw new StorageUploadError('ストレージへのアップロードに失敗しました');
    }

    if (target === 'notes') {
      return createStorageObjectReference(bucketName, objectPath);
    }

    const { data: publicURL } = supabase.storage
      .from(bucketName)
      .getPublicUrl(objectPath);

    if (!publicURL?.publicUrl) {
      throw new StorageUploadError('アップロード後の公開URL取得に失敗しました');
    }

    return publicURL.publicUrl;
  } catch (error) {
    if (error instanceof StorageUploadError) {
      throw error;
    }
    console.error('ストレージエラー:', error);
    throw new StorageUploadError('ストレージへのアップロード処理に失敗しました');
  }
};

export const createSignedUrlForStoredObject = async (reference: string): Promise<string> => {
  const parsed = parseStorageObjectReference(reference);
  if (!parsed) {
    return reference;
  }

  const { data, error } = await supabase.storage
    .from(parsed.bucketName)
    .createSignedUrl(parsed.objectPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('署名付きURLの生成に失敗しました', {
      bucketName: parsed.bucketName,
      objectPath: parsed.objectPath,
      message: error?.message,
    });
    throw new StorageUploadError('画像URLの生成に失敗しました');
  }

  return data.signedUrl;
};

/**
 * Deletes an existing object referenced by a public URL in the target bucket.
 *
 * This is intended for replacing user-owned assets (e.g. avatar update) and
 * will only delete objects that match the expected per-user path prefix.
 * 公開URLからファイルパスを逆算して削除する。アバター更新の時、古いファイルを削除するようにしている。
 * 他のユーザーのファイルを誤って削除しないように、ユーザープレフィックスと一致する場合にのみ削除する。
 */
export const deleteFromStorageByPublicUrl = async (
  publicUrl: string,
  userId: string,
  target: UploadTarget = 'avatars',
): Promise<void> => {
  const bucketName = resolveBucketName(target);
  const objectPath = resolveObjectPathFromPublicUrl(publicUrl, bucketName);
  if (!objectPath) return;

  const expectedPrefix = resolveExpectedPrefix(target, userId);
  if (!objectPath.startsWith(expectedPrefix)) {
    console.warn('削除対象のパスがユーザープレフィックスと一致しないためスキップします', {
      bucketName,
      objectPath,
      expectedPrefix,
    });
    return;
  }

  const { error } = await supabase.storage.from(bucketName).remove([objectPath]);
  if (error) {
    console.warn('旧ファイルの削除に失敗しました', {
      bucketName,
      objectPath,
      message: error.message,
    });
  }
};
