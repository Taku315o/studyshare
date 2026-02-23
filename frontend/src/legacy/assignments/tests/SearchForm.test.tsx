import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchForm from '../components/SearchForm';
import supabase from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('SearchForm', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSearchForm = async () => {
    render(<SearchForm onSearch={mockOnSearch} />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
  };

  describe('レンダリング', () => {
    it('should render search input and button', async () => {
      await renderSearchForm();

      expect(screen.getByPlaceholderText('キーワードで検索...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
    });

    it('should have correct input type and form structure', async () => {
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const button = screen.getByRole('button', { name: '検索' });
      const form = input.closest('form');

      expect(input).toHaveAttribute('type', 'text');
      expect(button).toHaveAttribute('type', 'submit');
      expect(form).toBeInTheDocument();
    });
  });

  describe('入力操作', () => {
    it('should update input value when user types', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      
      await user.type(input, 'test query');

      expect(input.value).toBe('test query');
    });

    it('should clear input value', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      
      await user.type(input, 'test query');
      expect(input.value).toBe('test query');

      await user.clear(input);
      expect(input.value).toBe('');
    });
  });

  describe('フォーム送信', () => {
    it('should call onSearch with input value when form is submitted', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, 'test query');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test query',
        university: '',
        faculty: '',
        department: '',
      });
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('should call onSearch when Enter key is pressed', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...');

      await user.type(input, 'test query');
      await user.keyboard('{Enter}');

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test query',
        university: '',
        faculty: '',
        department: '',
      });
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('should prevent default form submission', async () => {
      await renderSearchForm();

      const form = screen.getByRole('button', { name: '検索' }).closest('form')!;
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      
      fireEvent(form, submitEvent);

      expect(submitEvent.defaultPrevented).toBe(true);
    });
  });

  describe('入力値の正規化', () => {
    it('should trim whitespace from input value', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, '  test query  ');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test query',
        university: '',
        faculty: '',
        department: '',
      });
    });

    it('should handle empty input', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: '',
        university: '',
        faculty: '',
        department: '',
      });
    });

    it('should handle whitespace-only input', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, '   ');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: '',
        university: '',
        faculty: '',
        department: '',
      });
    });
  });

  describe('複数回の検索', () => {
    it('should handle multiple searches with different queries', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: '検索' });

      // 最初の検索
      await user.type(input, 'first query');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'first query',
        university: '',
        faculty: '',
        department: '',
      });

      // 入力をクリアして2回目の検索
      await user.clear(input);
      await user.type(input, 'second query');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'second query',
        university: '',
        faculty: '',
        department: '',
      });
      expect(mockOnSearch).toHaveBeenCalledTimes(2);
    });

    it('should maintain input value after submission', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, 'test query');
      await user.click(submitButton);

      expect(input.value).toBe('test query');
    });
  });

  describe('アクセシビリティ', () => {
    it('should have proper form structure for screen readers', async () => {
      await renderSearchForm();

      const form = screen.getByRole('button', { name: '検索' }).closest('form')!;
      const input = screen.getByPlaceholderText('キーワードで検索...');

      expect(form).toBeInTheDocument();
      expect(input).toBeInTheDocument();
      expect(form.contains(input)).toBe(true);
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      await renderSearchForm();

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const button = screen.getByRole('button', { name: '検索' });

      // Tab順序の確認
      await user.tab();
      expect(input).toHaveFocus();

      await user.tab();
      expect(button).toHaveFocus();
    });
  });
});
