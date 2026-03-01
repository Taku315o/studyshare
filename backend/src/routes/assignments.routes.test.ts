import request from 'supertest';
import { createApp } from '../app';
import { supabaseAdmin, supabaseAuth, supabaseFromToken } from '../lib/supabase';
import { resetIdempotencyStoreForTests } from '../middleware/idempotency';

const app = createApp({
  enableLegacyAssignmentsApi: true,
  enableLegacyUploadApi: true,
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-uuid'),
}));

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
  supabaseAuth: {
    auth: {
      getUser: jest.fn(),
    },
  },
  supabaseFromToken: jest.fn(),
}));

type MockedSupabaseAdmin = {
  from: jest.Mock;
  rpc: jest.Mock;
  storage: {
    from: jest.Mock;
  };
};

const mockedSupabaseAdmin = supabaseAdmin as unknown as MockedSupabaseAdmin;
const mockedGetUser = supabaseAuth.auth.getUser as jest.Mock;
const mockedSupabaseFromToken = supabaseFromToken as jest.Mock;

const mockAuthenticatedUser = (role: 'student' | 'admin', userId = 'user-1') => {
  mockedGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });

  const singleMock = jest.fn().mockResolvedValue({
    data: { email: `${userId}@example.com`, role },
    error: null,
  });
  const eqMock = jest.fn().mockReturnValue({ single: singleMock });
  const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
  const fromMock = jest.fn().mockReturnValue({ select: selectMock });

  mockedSupabaseFromToken.mockReturnValue({ from: fromMock });
};

const mockAuthenticatedUserWithoutLegacyUsersTable = (userId = 'user-1') => {
  mockedGetUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: `${userId}@example.com`,
        app_metadata: {},
      },
    },
    error: null,
  });

  const singleMock = jest.fn().mockResolvedValue({
    data: null,
    error: { message: 'relation "users" does not exist' },
  });
  const eqMock = jest.fn().mockReturnValue({ single: singleMock });
  const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
  const fromMock = jest.fn().mockReturnValue({ select: selectMock });

  mockedSupabaseFromToken.mockReturnValue({ from: fromMock });
};

describe('assignment routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetIdempotencyStoreForTests();
  });

  describe('POST /api/assignments', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const response = await request(app).post('/api/assignments').send({
        title: 'title',
        description: 'description',
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: '認証トークンが必要です' });
    });

    it('returns 400 when body validation fails for authenticated user', async () => {
      mockAuthenticatedUser('student');

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'description only',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          errors: expect.any(Array),
        })
      );
    });

    it('returns 201 when assignment is created successfully', async () => {
      mockAuthenticatedUser('student');

      const created = { id: 'assignment-1', title: 'title' };
      const singleMock = jest.fn().mockResolvedValue({ data: created, error: null });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      const insertMock = jest.fn().mockReturnValue({ select: selectMock });

      mockedSupabaseAdmin.from.mockReturnValue({ insert: insertMock });

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'title',
          description: 'description',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(created);
    });

    it('replays cached response when same Idempotency-Key is retried', async () => {
      mockAuthenticatedUser('student');

      const created = { id: 'assignment-1', title: 'title' };
      const singleMock = jest.fn().mockResolvedValue({ data: created, error: null });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      const insertMock = jest.fn().mockReturnValue({ select: selectMock });
      mockedSupabaseAdmin.from.mockReturnValue({ insert: insertMock });

      const requestBody = {
        title: 'title',
        description: 'description',
      };

      const first = await request(app)
        .post('/api/assignments')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'same-key')
        .send(requestBody);

      const second = await request(app)
        .post('/api/assignments')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'same-key')
        .send(requestBody);

      expect(first.status).toBe(201);
      expect(first.body).toEqual(created);
      expect(second.status).toBe(201);
      expect(second.body).toEqual(created);
      expect(second.headers['idempotency-replayed']).toBe('true');
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/assignments/:id', () => {
    it('returns 403 when authenticated user is not admin', async () => {
      mockAuthenticatedUser('student');

      const response = await request(app)
        .delete('/api/assignments/assignment-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: '管理者権限が必要です' });
    });

    it('returns 200 when authenticated admin deletes assignment', async () => {
      mockAuthenticatedUser('admin', 'admin-1');

      const eqMock = jest.fn().mockResolvedValue({ error: null });
      const deleteMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockedSupabaseAdmin.from.mockReturnValue({ delete: deleteMock });

      const response = await request(app)
        .delete('/api/assignments/assignment-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('POST /api/upload', () => {
    it('returns 400 when file is missing', async () => {
      mockAuthenticatedUser('student');

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ファイルがアップロードされていません' });
    });

    it('returns 400 when file type is invalid', async () => {
      mockAuthenticatedUser('student');

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', Buffer.from('plain text'), {
          filename: 'note.txt',
          contentType: 'text/plain',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: '無効なファイル形式です（png/jpg/webpのみ）' });
    });

    it('returns 400 when file size exceeds limit', async () => {
      mockAuthenticatedUser('student');

      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', oversizedBuffer, {
          filename: 'large.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ファイルサイズが大きすぎます（5MBまで）' });
    });

    it('returns 200 with url when upload succeeds', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'user-1/image.png' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/user-1/image.png' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ url: 'https://example.com/user-1/image.png' });
    });

    it('replays cached response when same Idempotency-Key is retried', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'user-1/image.png' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/user-1/image.png' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const first = await request(app)
        .post('/api/upload')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'upload-same-key')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.png',
          contentType: 'image/png',
        });

      const second = await request(app)
        .post('/api/upload')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'upload-same-key')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.png',
          contentType: 'image/png',
        });

      expect(first.status).toBe(200);
      expect(first.body).toEqual({ url: 'https://example.com/user-1/image.png' });
      expect(second.status).toBe(200);
      expect(second.body).toEqual({ url: 'https://example.com/user-1/image.png' });
      expect(second.headers['idempotency-replayed']).toBe('true');
      expect(uploadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/notes/upload', () => {
    it('returns 200 with url when upload succeeds', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'notes/user-1/image.webp' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/notes/user-1/image.webp' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const response = await request(app)
        .post('/api/notes/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.webp',
          contentType: 'image/webp',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ url: 'https://example.com/notes/user-1/image.webp' });
    });

    it('works even when legacy users table lookup fails', async () => {
      mockAuthenticatedUserWithoutLegacyUsersTable();

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'notes/user-1/image.webp' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/notes/user-1/image.webp' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const response = await request(app)
        .post('/api/notes/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.webp',
          contentType: 'image/webp',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ url: 'https://example.com/notes/user-1/image.webp' });
    });

    it('replays cached response when same Idempotency-Key is retried', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'notes/user-1/image.webp' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/notes/user-1/image.webp' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const first = await request(app)
        .post('/api/notes/upload')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'notes-upload-same-key')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.webp',
          contentType: 'image/webp',
        });

      const second = await request(app)
        .post('/api/notes/upload')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'notes-upload-same-key')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'image.webp',
          contentType: 'image/webp',
        });

      expect(first.status).toBe(200);
      expect(first.body).toEqual({ url: 'https://example.com/notes/user-1/image.webp' });
      expect(second.status).toBe(200);
      expect(second.body).toEqual({ url: 'https://example.com/notes/user-1/image.webp' });
      expect(second.headers['idempotency-replayed']).toBe('true');
      expect(uploadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/profiles/avatar/upload', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const response = await request(app).post('/api/profiles/avatar/upload');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: '認証トークンが必要です' });
    });

    it('returns 400 when file type is invalid', async () => {
      mockAuthenticatedUser('student');

      const response = await request(app)
        .post('/api/profiles/avatar/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', Buffer.from('plain text'), {
          filename: 'avatar.txt',
          contentType: 'text/plain',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: '無効なファイル形式です（png/jpg/webpのみ）' });
    });

    it('returns 400 when file size exceeds limit', async () => {
      mockAuthenticatedUser('student');

      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');
      const response = await request(app)
        .post('/api/profiles/avatar/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', oversizedBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ファイルサイズが大きすぎます（5MBまで）' });
    });

    it('returns 200 with url when upload succeeds', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'avatars/user-1/avatar.png' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/avatars/user-1/avatar.png' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const response = await request(app)
        .post('/api/profiles/avatar/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ url: 'https://example.com/avatars/user-1/avatar.png' });
    });

    it('replays cached response when same Idempotency-Key is retried', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'avatars/user-1/avatar.png' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/avatars/user-1/avatar.png' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const first = await request(app)
        .post('/api/profiles/avatar/upload')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'avatar-upload-same-key')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      const second = await request(app)
        .post('/api/profiles/avatar/upload')
        .set('Authorization', 'Bearer valid-token')
        .set('Idempotency-Key', 'avatar-upload-same-key')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(first.status).toBe(200);
      expect(first.body).toEqual({ url: 'https://example.com/avatars/user-1/avatar.png' });
      expect(second.status).toBe(200);
      expect(second.body).toEqual({ url: 'https://example.com/avatars/user-1/avatar.png' });
      expect(second.headers['idempotency-replayed']).toBe('true');
      expect(uploadMock).toHaveBeenCalledTimes(1);
    });

    it('deletes previous avatar when previousUrl is provided', async () => {
      mockAuthenticatedUser('student');

      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'avatars/user-1/new-avatar.png' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/avatars/user-1/new-avatar.png' },
      });
      const removeMock = jest.fn().mockResolvedValue({ error: null });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
        remove: removeMock,
      });

      const response = await request(app)
        .post('/api/profiles/avatar/upload')
        .set('Authorization', 'Bearer valid-token')
        .field('previousUrl', 'https://example.com/storage/v1/object/public/avatars/avatars/user-1/old-avatar.png')
        .attach('image', Buffer.from('image-bytes'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(removeMock).toHaveBeenCalledWith(['avatars/user-1/old-avatar.png']);
    });
  });

  describe('GET /api/assignments/search', () => {
    it('returns empty array when query is missing', async () => {
      const response = await request(app).get('/api/assignments/search');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns search results when query is provided', async () => {
      const assignments = [{ id: 'assignment-1', title: 'Search Match' }];
      mockedSupabaseAdmin.rpc.mockResolvedValue({
        data: assignments,
        error: null,
      });

      const response = await request(app).get('/api/assignments/search?query=search');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(assignments);
      expect(mockedSupabaseAdmin.rpc).toHaveBeenCalledWith('search_assignments', {
        search_query: 'search',
      });
    });
  });
});
