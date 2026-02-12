import {
  createAssignment,
  deleteAssignment,
  searchAssignments,
} from './assignmentService';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

type MockedSupabaseAdmin = {
  from: jest.Mock;
  rpc: jest.Mock;
};

const mockedSupabaseAdmin = supabaseAdmin as unknown as MockedSupabaseAdmin;

describe('assignmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAssignment', () => {
    it('creates an assignment successfully', async () => {
      const assignment = { id: 'assignment-1', title: 'title' };
      const singleMock = jest.fn().mockResolvedValue({ data: assignment, error: null });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      const insertMock = jest.fn().mockReturnValue({ select: selectMock });

      mockedSupabaseAdmin.from.mockReturnValue({ insert: insertMock });

      const result = await createAssignment({
        title: 'title',
        description: 'description',
        user_id: 'user-1',
      });

      expect(result).toEqual(assignment);
      expect(mockedSupabaseAdmin.from).toHaveBeenCalledWith('assignments');
    });

    it('throws a domain error when insert fails', async () => {
      const singleMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'insert failed' },
      });
      const selectMock = jest.fn().mockReturnValue({ single: singleMock });
      const insertMock = jest.fn().mockReturnValue({ select: selectMock });

      mockedSupabaseAdmin.from.mockReturnValue({ insert: insertMock });

      await expect(
        createAssignment({
          title: 'title',
          description: 'description',
          user_id: 'user-1',
        })
      ).rejects.toThrow('課題の作成に失敗しました');
    });
  });

  describe('searchAssignments', () => {
    it('returns assignments when rpc succeeds', async () => {
      const assignments = [{ id: 'assignment-1' }];
      mockedSupabaseAdmin.rpc.mockResolvedValue({ data: assignments, error: null });

      const result = await searchAssignments('keyword');

      expect(result).toEqual(assignments);
      expect(mockedSupabaseAdmin.rpc).toHaveBeenCalledWith('search_assignments', {
        search_query: 'keyword',
      });
    });

    it('throws a domain error when rpc fails', async () => {
      mockedSupabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'rpc failed' },
      });

      await expect(searchAssignments('keyword')).rejects.toThrow('課題の検索処理に失敗しました');
    });
  });

  describe('deleteAssignment', () => {
    it('throws when non-admin tries to delete another user assignment', async () => {
      const singleMock = jest.fn().mockResolvedValue({
        data: { user_id: 'user-2' },
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });

      mockedSupabaseAdmin.from.mockReturnValue({ select: selectMock });

      await expect(deleteAssignment('assignment-1', 'user-1', false)).rejects.toThrow(
        'この課題を削除する権限がありません'
      );
      expect(mockedSupabaseAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('throws when non-admin target assignment does not exist', async () => {
      const singleMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });

      mockedSupabaseAdmin.from.mockReturnValue({ select: selectMock });

      await expect(deleteAssignment('assignment-1', 'user-1', false)).rejects.toThrow(
        '課題が見つかりません'
      );
    });

    it('deletes assignment directly when user is admin', async () => {
      const eqMock = jest.fn().mockResolvedValue({ error: null });
      const deleteMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockedSupabaseAdmin.from.mockReturnValue({ delete: deleteMock });

      const result = await deleteAssignment('assignment-1', 'admin-1', true);

      expect(result).toEqual({ success: true });
      expect(mockedSupabaseAdmin.from).toHaveBeenCalledWith('assignments');
      expect(deleteMock).toHaveBeenCalledTimes(1);
    });

    it('throws a domain error when delete fails', async () => {
      const eqMock = jest.fn().mockResolvedValue({
        error: { message: 'delete failed' },
      });
      const deleteMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockedSupabaseAdmin.from.mockReturnValue({ delete: deleteMock });

      await expect(deleteAssignment('assignment-1', 'admin-1', true)).rejects.toThrow(
        '課題の削除に失敗しました'
      );
    });
  });
});
