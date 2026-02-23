import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileCard from './ProfileCard';

describe('ProfileCard', () => {
  it('opens edit modal and updates display name', async () => {
    const user = userEvent.setup();
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);

    render(
      <ProfileCard
        profile={{
          userId: 'user-1',
          displayName: '旧表示名',
          avatarUrl: null,
          affiliation: '所属未設定',
          universityId: 'uni-1',
          universityName: '専修大学',
          gradeYear: 2,
        }}
        universities={[
          { id: 'uni-1', name: '専修大学' },
          { id: 'uni-2', name: '明治大学' },
        ]}
        isLoading={false}
        isSaving={false}
        onSaveProfile={onSaveProfile}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    await user.clear(screen.getByLabelText('表示名'));
    await user.type(screen.getByLabelText('表示名'), '新しい表示名');
    await user.selectOptions(screen.getByLabelText('所属大学'), 'uni-2');
    await user.selectOptions(screen.getByLabelText('学年'), '3');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(onSaveProfile).toHaveBeenCalledWith({
        displayName: '新しい表示名',
        universityId: 'uni-2',
        gradeYear: 3,
      });
    });
  });
});
