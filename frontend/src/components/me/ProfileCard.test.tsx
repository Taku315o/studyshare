import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileCard from './ProfileCard';

describe('ProfileCard', () => {
  const baseProfile = {
    userId: 'user-1',
    displayName: '旧表示名',
    avatarUrl: null,
    faculty: '経済学部',
    universityId: 'uni-1',
    universityName: '専修大学',
    gradeYear: 2,
  };

  const universities = [
    { id: 'uni-1', name: '専修大学' },
    { id: 'uni-2', name: '明治大学' },
  ];

  it('opens edit modal and updates display name', async () => {
    const user = userEvent.setup();
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const avatarFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    render(
      <ProfileCard
        profile={baseProfile}
        universities={universities}
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
    await user.clear(screen.getByLabelText('学部（任意）'));
    await user.type(screen.getByLabelText('学部（任意）'), '理工学部');
    await user.upload(screen.getByLabelText('アバター画像（任意）'), avatarFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(onSaveProfile).toHaveBeenCalledWith({
        displayName: '新しい表示名',
        universityId: 'uni-2',
        gradeYear: 3,
        faculty: '理工学部',
        avatarFile,
      });
    });
  });

  it('closes the modal when clicking the overlay', async () => {
    const user = userEvent.setup();

    render(
      <ProfileCard
        profile={baseProfile}
        universities={universities}
        isLoading={false}
        isSaving={false}
        onSaveProfile={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    expect(screen.getByRole('heading', { name: 'プロフィール編集' })).toBeInTheDocument();

    await user.click(screen.getByTestId('profile-edit-modal-overlay'));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'プロフィール編集' })).not.toBeInTheDocument();
    });
  });

  it('does not close the modal by overlay click while saving', async () => {
    const user = userEvent.setup();

    render(
      <ProfileCard
        profile={baseProfile}
        universities={universities}
        isLoading={false}
        isSaving
        onSaveProfile={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    await user.click(screen.getByTestId('profile-edit-modal-overlay'));

    expect(screen.getByRole('heading', { name: 'プロフィール編集' })).toBeInTheDocument();
  });

  it('shows grade options from 1 to 6', async () => {
    const user = userEvent.setup();

    render(
      <ProfileCard
        profile={baseProfile}
        universities={universities}
        isLoading={false}
        isSaving={false}
        onSaveProfile={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));

    const gradeSelect = screen.getByLabelText('学年');
    const optionValues = within(gradeSelect).getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(optionValues).toEqual(['', '1', '2', '3', '4', '5', '6']);
  });

  it('does not submit when display name is blank', async () => {
    const user = userEvent.setup();
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);

    render(
      <ProfileCard
        profile={baseProfile}
        universities={universities}
        isLoading={false}
        isSaving={false}
        onSaveProfile={onSaveProfile}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'プロフィール編集' }));
    await user.clear(screen.getByLabelText('表示名'));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onSaveProfile).not.toHaveBeenCalled();
    expect(screen.getByText('表示名を入力してください。')).toBeInTheDocument();
  });

  it('shows 学部未設定 when faculty is empty', () => {
    render(
      <ProfileCard
        profile={{ ...baseProfile, faculty: null }}
        universities={universities}
        isLoading={false}
        isSaving={false}
        onSaveProfile={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('学部未設定')).toBeInTheDocument();
  });
});
