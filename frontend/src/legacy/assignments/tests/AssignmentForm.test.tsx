import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AssignmentForm from '../components/AssignmentForm';
import { useAuth } from '@/context/AuthContext';
import { uploadImage, createAssignment, setAuthToken } from '@/lib/api';

// モックの設定
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

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
  uploadImage: jest.fn(),
  createAssignment: jest.fn(),
  setAuthToken: jest.fn(),
  isUploadApiError: jest.fn((error: unknown) => Boolean(error && typeof error === 'object' && 'kind' in error)),
}));

jest.mock('next/image', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockImage({ src, alt, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

describe('AssignmentForm', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  };

  const mockAuth = {
    getAccessToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('レンダリング', () => {
    it('should render all form fields', () => {
      render(<AssignmentForm />);

      expect(screen.getByLabelText('タイトル')).toBeInTheDocument();
      expect(screen.getByLabelText('説明')).toBeInTheDocument();
      expect(screen.getByLabelText('画像（任意）')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument();
    });

    it('should have correct input types and attributes', () => {
      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const imageInput = screen.getByLabelText('画像（任意）');

      expect(titleInput).toHaveAttribute('type', 'text');
      expect(descriptionInput.tagName).toBe('TEXTAREA');
      expect(imageInput).toHaveAttribute('type', 'file');
      expect(imageInput).toHaveAttribute('accept', 'image/jpeg, image/png');
    });
  });

  describe('フォームバリデーション', () => {
    it('should show validation errors for required fields', async () => {
      const user = userEvent.setup();
      render(<AssignmentForm />);

      const submitButton = screen.getByRole('button', { name: '投稿する' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByText('必須項目です')).toHaveLength(2);
      });
    });

    it('should clear validation errors when valid input is provided', async () => {
      const user = userEvent.setup();
      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      // まずエラーを表示
      await user.click(submitButton);
      await waitFor(() => {
        expect(screen.getAllByText('必須項目です')).toHaveLength(2);
      });

      // 有効な入力をして、エラーが消えることを確認
      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');

      await waitFor(() => {
        expect(screen.queryByText('必須項目です')).not.toBeInTheDocument();
      });
    });
  });

  describe('画像アップロード', () => {
    it('should accept valid image files', async () => {
      const user = userEvent.setup();
      render(<AssignmentForm />);

      const imageInput = screen.getByLabelText('画像（任意）') as HTMLInputElement;
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(imageInput, validFile);

      expect(imageInput.files).toHaveLength(1);
      expect(imageInput.files?.[0]).toBe(validFile);
    });

    it('should reject invalid file formats', async () => {
      render(<AssignmentForm />);

      const imageInput = screen.getByLabelText('画像（任意）') as HTMLInputElement;
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      fireEvent.change(imageInput, { target: { files: [invalidFile] } });

      expect(toast.error).toHaveBeenCalledWith('JPEGまたはPNG形式の画像のみアップロード可能です');
    });

    it('should reject files larger than 5MB', async () => {
      const user = userEvent.setup();
      render(<AssignmentForm />);

      const imageInput = screen.getByLabelText('画像（任意）');
      // 5MB超のファイルを作成
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      await user.upload(imageInput, largeFile);

      expect(toast.error).toHaveBeenCalledWith('ファイルサイズは5MB以下にしてください');
    });

    it('should show image preview for valid files', async () => {
      const user = userEvent.setup();
      
      // FileReaderのモック
      const mockFileReader = {
        readAsDataURL: jest.fn(),
        result: 'data:image/jpeg;base64,mock-image-data',
        onload: null as (() => void) | null,
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.FileReader = jest.fn(() => mockFileReader) as any;

      render(<AssignmentForm />);

      const imageInput = screen.getByLabelText('画像（任意）');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(imageInput, validFile);

      // FileReader.onloadを手動で実行
      act(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      });

      await waitFor(() => {
        const previewImage = screen.getByAltText('Preview');
        expect(previewImage).toBeInTheDocument();
        expect(previewImage).toHaveAttribute('src', 'data:image/jpeg;base64,mock-image-data');
      });
    });
  });

  describe('フォーム送信', () => {
    beforeEach(() => {
      mockAuth.getAccessToken.mockResolvedValue('mock-token');
      (uploadImage as jest.Mock).mockResolvedValue({ url: 'https://example.com/image.jpg' });
      (createAssignment as jest.Mock).mockResolvedValue({ id: '1' });
    });

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');
      await user.click(submitButton);

      await waitFor(() => {
        expect(setAuthToken).toHaveBeenCalledWith('mock-token');
        expect(createAssignment).toHaveBeenCalledWith({
          title: 'Test Title',
          description: 'Test Description',
          image_url: undefined,
        });
        expect(toast.success).toHaveBeenCalledWith('課題を投稿しました');
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });

    it('should submit form with image', async () => {
      const user = userEvent.setup();
      
      // FileReaderのモック
      const mockFileReader = {
        readAsDataURL: jest.fn(),
        result: 'data:image/jpeg;base64,mock-image-data',
        onload: null as (() => void) | null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.FileReader = jest.fn(() => mockFileReader) as any;

      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const imageInput = screen.getByLabelText('画像（任意）');
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');
      
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await user.upload(imageInput, validFile);
      
      act(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(uploadImage).toHaveBeenCalledWith(validFile);
        expect(createAssignment).toHaveBeenCalledWith({
          title: 'Test Title',
          description: 'Test Description',
          image_url: 'https://example.com/image.jpg',
        });
      });
    });

    it('should handle authentication error', async () => {
      const user = userEvent.setup();
      mockAuth.getAccessToken.mockResolvedValue(null);

      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('ログインが必要です');
        expect(mockRouter.push).toHaveBeenCalledWith('/auth/login');
      });
    });

    it('should handle submission error', async () => {
      const user = userEvent.setup();
      (createAssignment as jest.Mock).mockRejectedValue(new Error('Server error'));

      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('投稿に失敗しました');
      });
    });

    it('should disable submit button during upload', async () => {
      const user = userEvent.setup();
      
      // createAssignmentを遅延させる
      let resolveCreateAssignment: (value: { id: string }) => void;
      (createAssignment as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          resolveCreateAssignment = resolve;
        })
      );

      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル');
      const descriptionInput = screen.getByLabelText('説明');
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');
      await user.click(submitButton);

      // ボタンが無効化され、テキストが変更されることを確認
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent('投稿中...');
      });

      // API呼び出しを完了
      act(() => {
        resolveCreateAssignment({ id: '1' });
      });

      // ボタンが再び有効になることを確認
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
        expect(submitButton).toHaveTextContent('投稿する');
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      render(<AssignmentForm />);

      const titleInput = screen.getByLabelText('タイトル') as HTMLInputElement;
      const descriptionInput = screen.getByLabelText('説明') as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', { name: '投稿する' });

      await user.type(titleInput, 'Test Title');
      await user.type(descriptionInput, 'Test Description');
      await user.click(submitButton);

      await waitFor(() => {
        expect(titleInput.value).toBe('');
        expect(descriptionInput.value).toBe('');
      });
    });
  });
});
