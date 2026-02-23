import {
  isValidFileSize,
  isValidImageType,
  uploadToStorage,
} from './uploadService';
import { supabaseAdmin } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
}));

type MockedSupabaseAdmin = {
  storage: {
    from: jest.Mock;
  };
};

const mockedSupabaseAdmin = supabaseAdmin as unknown as MockedSupabaseAdmin;
const mockedUuid = uuidv4 as jest.Mock;

describe('uploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUuid.mockReturnValue('fixed-uuid');
  });

  describe('isValidImageType', () => {
    it('accepts jpeg, png and webp', () => {
      expect(isValidImageType('image/jpeg')).toBe(true);
      expect(isValidImageType('image/png')).toBe(true);
      expect(isValidImageType('image/webp')).toBe(true);
    });

    it('rejects unsupported mime types', () => {
      expect(isValidImageType('image/gif')).toBe(false);
      expect(isValidImageType('text/plain')).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('accepts exactly 5MB', () => {
      expect(isValidFileSize(5 * 1024 * 1024)).toBe(true);
    });

    it('rejects over 5MB', () => {
      expect(isValidFileSize(5 * 1024 * 1024 + 1)).toBe(false);
    });
  });

  describe('uploadToStorage', () => {
    it('uploads file and returns public url', async () => {
      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'user-1/fixed-uuid.png' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/user-1/fixed-uuid.png' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const result = await uploadToStorage(
        {
          originalname: 'sample.png',
          mimetype: 'image/png',
          buffer: Buffer.from('image'),
          size: 100,
        },
        'user-1'
      );

      expect(result).toBe('https://example.com/user-1/fixed-uuid.png');
      expect(mockedSupabaseAdmin.storage.from).toHaveBeenCalledWith('assignments');
      expect(uploadMock).toHaveBeenCalledWith(
        'user-1/fixed-uuid.png',
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'image/png',
          upsert: false,
        })
      );
    });

    it('throws a domain error when upload fails', async () => {
      const uploadMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'upload failed' },
      });
      const getPublicUrlMock = jest.fn();

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      await expect(
        uploadToStorage(
          {
            originalname: 'sample.png',
            mimetype: 'image/png',
            buffer: Buffer.from('image'),
            size: 100,
          },
          'user-1'
        )
      ).rejects.toThrow('ファイルのアップロード処理に失敗しました');
    });

    it('stores note images under notes prefix', async () => {
      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: 'notes/user-1/fixed-uuid.webp' },
        error: null,
      });
      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/notes/user-1/fixed-uuid.webp' },
      });

      mockedSupabaseAdmin.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const result = await uploadToStorage(
        {
          originalname: 'sample.webp',
          mimetype: 'image/webp',
          buffer: Buffer.from('image'),
          size: 100,
        },
        'user-1',
        'notes'
      );

      expect(result).toBe('https://example.com/notes/user-1/fixed-uuid.webp');
      expect(mockedSupabaseAdmin.storage.from).toHaveBeenCalledWith('notes');
      expect(uploadMock).toHaveBeenCalledWith(
        'notes/user-1/fixed-uuid.webp',
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'image/webp',
          upsert: false,
        })
      );
    });
  });
});
