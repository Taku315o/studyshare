import MockAdapter from 'axios-mock-adapter';
import {
  uploadImage,
  uploadNoteImage,
  uploadAvatarImage,
  createAssignment,
  searchAssignments,
  deleteAssignment,
  setAuthToken,
} from '../api';
import api from '../api';

// API用のモックを作成（デフォルトのaxiosインスタンスではなく、API用のインスタンスをモック）
const mock = new MockAdapter(api);

describe('API Functions', () => {
  beforeEach(() => {
    mock.reset();
  });

  describe('setAuthToken', () => {
    it('should set authorization header when token is provided', () => {
      const token = 'test-token';
      setAuthToken(token);
      
      // API インスタンスのヘッダーを確認
      expect(api.defaults.headers.common['Authorization']).toBe(`Bearer ${token}`);
    });

    it('should remove authorization header when token is null', () => {
      setAuthToken(null);
      
      expect(api.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('uploadImage', () => {
    it('should upload image successfully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse = { url: 'https://example.com/image.jpg' };
      
      mock.onPost('/upload').reply(200, mockResponse);
      
      const result = await uploadImage(mockFile);
      
      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/upload');
      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBeTruthy();
    });

    it('should handle upload error', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      mock.onPost('/upload').reply(500, { error: 'Upload failed' });
      
      await expect(uploadImage(mockFile)).rejects.toThrow();
    });

    it('should reuse provided idempotency key', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse = { url: 'https://example.com/image.jpg' };
      const idempotencyKey = 'retry-key-1';

      mock.onPost('/upload').reply(200, mockResponse);

      await uploadImage(mockFile, { idempotencyKey });

      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBe(idempotencyKey);
    });
  });

  describe('uploadNoteImage', () => {
    it('should upload note image successfully', async () => {
      const mockFile = new File(['test'], 'note.png', { type: 'image/png' });
      const mockResponse = { url: 'https://example.com/notes/image.png' };

      mock.onPost('/notes/upload').reply(200, mockResponse);

      const result = await uploadNoteImage(mockFile);

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/notes/upload');
      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBeTruthy();
    });

    it('should handle note image upload error', async () => {
      const mockFile = new File(['test'], 'note.png', { type: 'image/png' });

      mock.onPost('/notes/upload').reply(500, { error: 'Upload failed' });

      await expect(uploadNoteImage(mockFile)).rejects.toThrow();
    });
  });

  describe('uploadAvatarImage', () => {
    it('should upload avatar image successfully', async () => {
      const mockFile = new File(['test'], 'avatar.png', { type: 'image/png' });
      const mockResponse = { url: 'https://example.com/avatars/avatar.png' };

      mock.onPost('/profiles/avatar/upload').reply(200, mockResponse);

      const result = await uploadAvatarImage(mockFile);

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/profiles/avatar/upload');
      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBeTruthy();
    });

    it('should reuse provided idempotency key for avatar upload', async () => {
      const mockFile = new File(['test'], 'avatar.png', { type: 'image/png' });
      const idempotencyKey = 'avatar-retry-key';
      const mockResponse = { url: 'https://example.com/avatars/avatar.png' };

      mock.onPost('/profiles/avatar/upload').reply(200, mockResponse);

      await uploadAvatarImage(mockFile, { idempotencyKey });

      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBe(idempotencyKey);
    });
  });

  describe('createAssignment', () => {
    it('should create assignment successfully', async () => {
      const assignmentData = {
        title: 'Test Assignment',
        description: 'Test Description',
        image_url: 'https://example.com/image.jpg'
      };
      const mockResponse = { id: '1', ...assignmentData };
      
      mock.onPost('/assignments').reply(200, mockResponse);
      
      const result = await createAssignment(assignmentData);
      
      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].url).toBe('/assignments');
      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBeTruthy();
    });

    it('should create assignment without image', async () => {
      const assignmentData = {
        title: 'Test Assignment',
        description: 'Test Description'
      };
      const mockResponse = { id: '1', ...assignmentData };
      
      mock.onPost('/assignments').reply(200, mockResponse);
      
      const result = await createAssignment(assignmentData);
      
      expect(result).toEqual(mockResponse);
    });

    it('should handle create assignment error', async () => {
      const assignmentData = {
        title: 'Test Assignment',
        description: 'Test Description'
      };
      
      mock.onPost('/assignments').reply(400, { error: 'Bad request' });
      
      await expect(createAssignment(assignmentData)).rejects.toThrow();
    });

    it('should reuse provided idempotency key for create', async () => {
      const assignmentData = {
        title: 'Test Assignment',
        description: 'Test Description',
      };
      const idempotencyKey = 'retry-key-create';

      mock.onPost('/assignments').reply(200, { id: '1', ...assignmentData });

      await createAssignment(assignmentData, { idempotencyKey });

      expect(mock.history.post[0].headers?.['Idempotency-Key']).toBe(idempotencyKey);
    });
  });

  describe('searchAssignments', () => {
    it('should search assignments successfully', async () => {
      const query = 'test query';
      const mockResponse = [
        { id: '1', title: 'Assignment 1', description: 'Description 1' },
        { id: '2', title: 'Assignment 2', description: 'Description 2' }
      ];
      
      mock.onGet(`/assignments/search?query=${encodeURIComponent(query)}`).reply(200, mockResponse);
      
      const result = await searchAssignments(query);
      
      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].url).toBe(`/assignments/search?query=${encodeURIComponent(query)}`);
    });

    it('should handle search error', async () => {
      const query = 'test query';
      
      mock.onGet(`/assignments/search?query=${encodeURIComponent(query)}`).reply(500, { error: 'Search failed' });
      
      await expect(searchAssignments(query)).rejects.toThrow();
    });
  });

  describe('deleteAssignment', () => {
    it('should delete assignment successfully', async () => {
      const assignmentId = '1';
      const mockResponse = { message: 'Assignment deleted' };
      
      mock.onDelete(`/assignments/${assignmentId}`).reply(200, mockResponse);
      
      const result = await deleteAssignment(assignmentId);
      
      expect(result).toEqual(mockResponse);
      expect(mock.history.delete[0].url).toBe(`/assignments/${assignmentId}`);
    });

    it('should handle delete error', async () => {
      const assignmentId = '1';
      
      mock.onDelete(`/assignments/${assignmentId}`).reply(403, { error: 'Forbidden' });
      
      await expect(deleteAssignment(assignmentId)).rejects.toThrow();
    });
  });
});
