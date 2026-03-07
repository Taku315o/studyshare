//studyshare/frontend/src/lib/api.ts
// This file contains the API client setup and various API functions for the StudyShare application.
// It uses Axios for HTTP requests and includes functions for authentication, image upload, and assignment management
import axios, { type AxiosError } from 'axios';
//バックエンドのExpressサーバーと通信するためのAPIクライアントです。
// axiosライブラリを使い、画像アップロード、課題の投稿・検索・削除といった各APIリクエストを行う関数を定義しています。
/**
 * Preconfigured Axios instance targeting the backend API base URL.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3001/api',
});

export const createIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

type IdempotentRequestOptions = {
  idempotencyKey?: string;
};

type AvatarUploadOptions = IdempotentRequestOptions & {
  previousUrl?: string | null;
};

const resolveIdempotencyKey = (idempotencyKey?: string): string =>
  idempotencyKey?.trim() || createIdempotencyKey();

type UploadErrorResponse = {
  error?: string;
  code?: string;
};

export type UploadErrorKind = 'FILE_TOO_LARGE' | 'STORAGE_ERROR' | 'UNKNOWN';

const FILE_TOO_LARGE_ERROR_CODE = 'FILE_TOO_LARGE';
const STORAGE_UPLOAD_ERROR_CODE = 'STORAGE_UPLOAD_FAILED';

export class UploadApiError extends Error {
  readonly kind: UploadErrorKind;
  readonly status: number | null;
  readonly code: string | null;

  constructor(params: { message: string; kind: UploadErrorKind; status?: number; code?: string }) {
    super(params.message);
    this.name = 'UploadApiError';
    this.kind = params.kind;
    this.status = params.status ?? null;
    this.code = params.code ?? null;
  }
}

export const isUploadApiError = (error: unknown): error is UploadApiError => {
  return error instanceof UploadApiError;
};

const isAxiosRequestError = (error: unknown): error is AxiosError<UploadErrorResponse> => {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error;
};

const toUploadApiError = (error: unknown): UploadApiError => {
  if (error instanceof UploadApiError) {
    return error;
  }

  if (!isAxiosRequestError(error)) {
    return new UploadApiError({
      kind: 'UNKNOWN',
      message: '画像アップロードに失敗しました',
    });
  }

  const responseData = (error.response?.data ?? null) as UploadErrorResponse | null;
  const code = responseData?.code?.trim() || null;
  const status = typeof error.response?.status === 'number' ? error.response.status : undefined;

  if (code === FILE_TOO_LARGE_ERROR_CODE || status === 413) {
    return new UploadApiError({
      kind: 'FILE_TOO_LARGE',
      message: responseData?.error || 'ファイルサイズが大きすぎます（5MBまで）',
      status,
      code: code ?? FILE_TOO_LARGE_ERROR_CODE,
    });
  }

  if (code === STORAGE_UPLOAD_ERROR_CODE || status === 503) {
    return new UploadApiError({
      kind: 'STORAGE_ERROR',
      message: responseData?.error || 'ストレージへのアップロードに失敗しました。時間をおいて再度お試しください。',
      status,
      code: code ?? STORAGE_UPLOAD_ERROR_CODE,
    });
  }

  return new UploadApiError({
    kind: 'UNKNOWN',
    message: responseData?.error || error.message || '画像アップロードに失敗しました',
    status,
    code: code ?? undefined,
  });
};

const postUploadImage = async (
  path: string,
  formData: FormData,
  idempotencyKey?: string,
): Promise<{ url: string }> => {
  try {
    const response = await api.post<{ url: string }>(path, formData, {
      headers: {
        'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
      },
    });

    return response.data;
  } catch (error) {
    throw toUploadApiError(error);
  }
};

/**
 * Applies or removes the Authorization header used for authenticated API requests.
 *
 * @param token - JWT retrieved from Supabase; pass null to clear the header.
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

/**
 * Legacy: Uploads an image file to the backend and returns the resulting public URL.
 * This endpoint depends on backend `ENABLE_LEGACY_UPLOAD_API=true`.
 *
 * @param file - Browser File object selected by the user.
 * @returns A promise resolving to an object containing the uploaded image URL.
 */
export const uploadImage = async (
  file: File,
  options?: IdempotentRequestOptions,
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  return postUploadImage('/upload', formData, options?.idempotencyKey);
};

/**
 * Uploads a note image file to the backend and returns its public URL.
 *
 * @param file - Browser File object selected by the user.
 * @returns A promise resolving to an object containing the uploaded image URL.
 */
export const uploadNoteImage = async (
  file: File,
  options?: IdempotentRequestOptions,
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  return postUploadImage('/notes/upload', formData, options?.idempotencyKey);
};

/**
 * Uploads a profile avatar image file to the backend and returns its public URL.
 *
 * @param file - Browser File object selected by the user.
 * @returns A promise resolving to an object containing the uploaded avatar URL.
 */
export const uploadAvatarImage = async (
  file: File,
  options?: AvatarUploadOptions,
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('image', file);
  const previousUrl = options?.previousUrl?.trim();
  if (previousUrl) {
    formData.append('previousUrl', previousUrl);
  }

  return postUploadImage('/profiles/avatar/upload', formData, options?.idempotencyKey);
};

/**
 * Legacy: Sends a request to create a new assignment using the backend API.
 * This endpoint depends on backend `ENABLE_LEGACY_ASSIGNMENTS_API=true`.
 *
 * @param data - Assignment payload including title, description, and an optional image URL.
 * @returns A promise resolving to the created assignment object.
 */
export const createAssignment = async (data: {
  title: string;
  description: string;
  image_url?: string;
  university?: string;
  faculty?: string;
  department?: string;
  course_name?: string;
  teacher_name?: string;
}, options?: IdempotentRequestOptions) => {
  const response = await api.post('/assignments', data, {
    headers: {
      'Idempotency-Key': resolveIdempotencyKey(options?.idempotencyKey),
    },
  });
  return response.data;
};

/**
 * Legacy: Searches assignments using the backend API's query endpoint.
 * This endpoint depends on backend `ENABLE_LEGACY_ASSIGNMENTS_API=true`.
 *
 * @param query - Free-text query submitted by the user.
 * @returns A promise resolving to the array of assignments returned by the server.
 */
export const searchAssignments = async (query: string) => {
  const response = await api.get(`/assignments/search?query=${encodeURIComponent(query)}`);
  return response.data;
};

/**
 * Legacy: Deletes an assignment via the backend API. Requires administrator privileges.
 * This endpoint depends on backend `ENABLE_LEGACY_ASSIGNMENTS_API=true`.
 *
 * @param id - Identifier of the assignment to remove.
 * @returns A promise resolving once the backend acknowledges the deletion.
 */
export const deleteAssignment = async (id: string) => {
  const response = await api.delete(`/assignments/${id}`);
  return response.data;
};

export default api;
