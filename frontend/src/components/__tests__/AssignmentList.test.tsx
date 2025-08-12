import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import AssignmentList from '../AssignmentList';
import { useAuth } from '@/context/AuthContext';
import { deleteAssignment } from '@/lib/api';
import supabase from '@/lib/supabase';

// モックの設定
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  deleteAssignment: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: jest.fn(),
  },
}));

jest.mock('next/image', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockImage({ src, alt, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

const mockAssignments = [
  {
    id: '1',
    title: 'Test Assignment 1',
    description: 'Test Description 1',
    image_url: 'https://example.com/image1.jpg',
    user_id: 'user-1',
    created_at: '2023-01-01T00:00:00.000Z',
    user: {
      email: 'user1@example.com',
    },
  },
  {
    id: '2',
    title: 'Test Assignment 2',
    description: 'Test Description 2',
    image_url: null,
    user_id: 'user-2',
    created_at: '2023-01-02T00:00:00.000Z',
    user: {
      email: 'user2@example.com',
    },
  },
];

describe('AssignmentList', () => {
  const mockAuth = {
    isAdmin: false,
    getAccessToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('レンダリング', () => {
    it('should render loading state initially', () => {
      // Supabaseの応答を遅延させる
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => new Promise(() => {})), // 永続的に待機
        })),
      });

      render(<AssignmentList />);

      expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    });

    it('should render assignments when loaded', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockAssignments,
            error: null,
          })),
        })),
      });

      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
        expect(screen.getByText('Test Assignment 2')).toBeInTheDocument();
        expect(screen.getByText('Test Description 1')).toBeInTheDocument();
        expect(screen.getByText('Test Description 2')).toBeInTheDocument();
      });
    });

    it('should render images when provided', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockAssignments,
            error: null,
          })),
        })),
      });

      render(<AssignmentList />);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images[0]).toHaveAttribute('src', 'https://example.com/image1.jpg');
      });
    });

    it('should not render delete buttons for non-admin users', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockAssignments,
            error: null,
          })),
        })),
      });

      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.queryByText('削除')).not.toBeInTheDocument();
      });
    });

    it('should render delete buttons for admin users', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        isAdmin: true,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockAssignments,
            error: null,
          })),
        })),
      });

      render(<AssignmentList />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByText('削除');
        expect(deleteButtons).toHaveLength(2);
      });
    });
  });

  describe('検索機能', () => {
    it('should use search function when query is provided', async () => {
      const mockSearchResults = [mockAssignments[0]];
      
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockSearchResults,
        error: null,
      });

      render(<AssignmentList query="test query" />);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('search_assignments', {
          search_query: 'test query',
        });
        expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Assignment 2')).not.toBeInTheDocument();
      });
    });

    it('should handle search errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Search failed'),
      });

      render(<AssignmentList query="test query" />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('課題取得エラー:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('削除機能', () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        isAdmin: true,
        getAccessToken: jest.fn().mockResolvedValue('mock-token'),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockAssignments,
            error: null,
          })),
        })),
      });

      (deleteAssignment as jest.Mock).mockResolvedValue({ success: true });
      window.confirm = jest.fn(() => true);
    });

    it('should delete assignment successfully', async () => {
      const user = userEvent.setup();
      
      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('削除');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(deleteAssignment).toHaveBeenCalledWith('1');
        expect(toast.success).toHaveBeenCalledWith('課題を削除しました');
      });
    });

    it('should handle delete error when no access token', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        isAdmin: true,
        getAccessToken: jest.fn().mockResolvedValue(null),
      });

      const user = userEvent.setup();

      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('削除');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('削除に失敗しました');
      });
    });

    it('should handle delete API error', async () => {
      (deleteAssignment as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      const user = userEvent.setup();
      
      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('削除');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('削除に失敗しました');
      });
    });

    it('should refresh assignments after successful deletion', async () => {
      const user = userEvent.setup();
      
      // 最初のレンダリング時のモック
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                data: mockAssignments,
                error: null,
              });
            } else {
              return Promise.resolve({
                data: [mockAssignments[1]],
                error: null,
              });
            }
          }),
        })),
      }));
      
      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.getByText('Test Assignment 1')).toBeInTheDocument();
        expect(screen.getByText('Test Assignment 2')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('削除');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Test Assignment 1')).not.toBeInTheDocument();
        expect(screen.getByText('Test Assignment 2')).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('should handle fetch assignments error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: null,
            error: new Error('Fetch failed'),
          })),
        })),
      });

      render(<AssignmentList />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('課題取得エラー:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should render empty state when no assignments', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [],
            error: null,
          })),
        })),
      });

      render(<AssignmentList />);

      await waitFor(() => {
        expect(screen.getByText('課題はまだ投稿されていません')).toBeInTheDocument();
      });
    });
  });
});
