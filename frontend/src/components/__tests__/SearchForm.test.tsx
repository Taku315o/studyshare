import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchForm from '../SearchForm';

describe('SearchForm', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('レンダリング', () => {
    it('should render search input and button', () => {
      render(<SearchForm onSearch={mockOnSearch} />);

      expect(screen.getByPlaceholderText('キーワードで検索...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
    });

    it('should have correct input type and form structure', () => {
      render(<SearchForm onSearch={mockOnSearch} />);

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
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      
      await user.type(input, 'test query');

      expect(input.value).toBe('test query');
    });

    it('should clear input value', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

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
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, 'test query');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith('test query');
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('should call onSearch when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...');

      await user.type(input, 'test query');
      await user.keyboard('{Enter}');

      expect(mockOnSearch).toHaveBeenCalledWith('test query');
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('should prevent default form submission', () => {
      render(<SearchForm onSearch={mockOnSearch} />);

      const form = screen.getByRole('button', { name: '検索' }).closest('form')!;
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      
      fireEvent(form, submitEvent);

      expect(submitEvent.defaultPrevented).toBe(true);
    });
  });

  describe('入力値の正規化', () => {
    it('should trim whitespace from input value', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, '  test query  ');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith('test query');
    });

    it('should handle empty input', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith('');
    });

    it('should handle whitespace-only input', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...');
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, '   ');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith('');
    });
  });

  describe('複数回の検索', () => {
    it('should handle multiple searches with different queries', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: '検索' });

      // 最初の検索
      await user.type(input, 'first query');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith('first query');

      // 入力をクリアして2回目の検索
      await user.clear(input);
      await user.type(input, 'second query');
      await user.click(submitButton);

      expect(mockOnSearch).toHaveBeenCalledWith('second query');
      expect(mockOnSearch).toHaveBeenCalledTimes(2);
    });

    it('should maintain input value after submission', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText('キーワードで検索...') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: '検索' });

      await user.type(input, 'test query');
      await user.click(submitButton);

      expect(input.value).toBe('test query');
    });
  });

  describe('アクセシビリティ', () => {
    it('should have proper form structure for screen readers', () => {
      render(<SearchForm onSearch={mockOnSearch} />);

      const form = screen.getByRole('button', { name: '検索' }).closest('form')!;
      const input = screen.getByPlaceholderText('キーワードで検索...');

      expect(form).toBeInTheDocument();
      expect(input).toBeInTheDocument();
      expect(form.contains(input)).toBe(true);
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<SearchForm onSearch={mockOnSearch} />);

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
