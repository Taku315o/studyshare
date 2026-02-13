import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import ProfilePage from './page';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/components/Header', () => {
  return function MockHeader() {
    return <div>Header</div>;
  };
});

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    from: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('next/image', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockImage({ src, alt, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

describe('ProfilePage', () => {
  const mockReplace = jest.fn();
  const mockAuthUser = {
    id: 'user-1',
    email: 'test@example.com',
  };

  const mockAssignments = [
    {
      id: '1',
      title: 'My Assignment',
      description: 'My Description',
      image_url: 'https://example.com/image.jpg',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      university: null,
      faculty: null,
      department: null,
      course_name: null,
      teacher_name: null,
      user_id: 'user-1',
    },
  ];

  const selectMock = jest.fn();
  const eqSelectMock = jest.fn();
  const orderMock = jest.fn();
  const deleteMock = jest.fn();
  const eqDeleteIdMock = jest.fn();
  const eqDeleteUserIdMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    selectMock.mockReturnValue({ eq: eqSelectMock });
    eqSelectMock.mockReturnValue({ order: orderMock });

    deleteMock.mockReturnValue({ eq: eqDeleteIdMock });
    eqDeleteIdMock.mockReturnValue({ eq: eqDeleteUserIdMock });

    (supabase.from as jest.Mock).mockReturnValue({
      select: selectMock,
      delete: deleteMock,
    });
  });

  it('shows loading state while auth is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

    render(<ProfilePage />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('redirects to top page when unauthenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('fetches and renders current user assignments', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockAuthUser, isLoading: false });
    orderMock.mockResolvedValue({ data: mockAssignments, error: null });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('My Assignment')).toBeInTheDocument();
    });

    expect(selectMock).toHaveBeenCalledWith(
      'id,title,description,image_url,created_at,updated_at,university,faculty,department,course_name,teacher_name,user_id',
    );
    expect(eqSelectMock).toHaveBeenCalledWith('user_id', 'user-1');

    const editLink = screen.getByRole('link', { name: '編集' });
    expect(editLink).toHaveAttribute('href', '/assignments/1/edit');
  });

  it('does not delete when confirmation is cancelled', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockAuthUser, isLoading: false });
    orderMock.mockResolvedValue({ data: mockAssignments, error: null });
    window.confirm = jest.fn(() => false);
    const user = userEvent.setup();

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('My Assignment')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes assignment and removes it from list', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockAuthUser, isLoading: false });
    orderMock.mockResolvedValue({ data: mockAssignments, error: null });
    eqDeleteUserIdMock.mockResolvedValue({ error: null });
    window.confirm = jest.fn(() => true);
    const user = userEvent.setup();

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('My Assignment')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(eqDeleteIdMock).toHaveBeenCalledWith('id', '1');
      expect(eqDeleteUserIdMock).toHaveBeenCalledWith('user_id', 'user-1');
      expect(toast.success).toHaveBeenCalledWith('課題を削除しました');
      expect(screen.queryByText('My Assignment')).not.toBeInTheDocument();
    });
  });

  it('shows fetch error toast and message on fetch failure', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockAuthUser, isLoading: false });
    orderMock.mockResolvedValue({ data: null, error: new Error('fetch failed') });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('課題の取得に失敗しました');
    });

    expect(screen.getByText('課題の取得に失敗しました。時間をおいて再度お試しください。')).toBeInTheDocument();
  });

  it('shows delete error toast and keeps assignment when delete fails', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockAuthUser, isLoading: false });
    orderMock.mockResolvedValue({ data: mockAssignments, error: null });
    eqDeleteUserIdMock.mockResolvedValue({ error: new Error('delete failed') });
    window.confirm = jest.fn(() => true);
    const user = userEvent.setup();

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('My Assignment')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('課題の削除に失敗しました');
      expect(screen.getByText('My Assignment')).toBeInTheDocument();
    });
  });
});
