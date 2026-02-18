import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileCard from './ProfileCard';

describe('ProfileCard', () => {
  it('opens edit modal and updates display name', async () => {
    const user = userEvent.setup();
    const onSaveDisplayName = jest.fn().mockResolvedValue(undefined);

    render(
      <ProfileCard
        profile={{
          userId: 'user-1',
          displayName: '旧表示名',
          avatarUrl: null,
          affiliation: '所属未設定',
        }}
        isLoading={false}
        isSaving={false}
        onSaveDisplayName={onSaveDisplayName}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    await user.clear(screen.getByLabelText('表示名'));
    await user.type(screen.getByLabelText('表示名'), '新しい表示名');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(onSaveDisplayName).toHaveBeenCalledWith('新しい表示名');
    });
  });
});
