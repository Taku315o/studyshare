import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageComposer from '@/components/community/MessageComposer';

describe('MessageComposer', () => {
  it('sends message by button click and Enter key', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<MessageComposer onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('メッセージを入力...');
    await user.type(textarea, 'hello');
    await user.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('hello');
    });

    await user.type(textarea, 'world');
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('world');
    });

    expect(onSend).toHaveBeenCalledTimes(2);
  });
});
