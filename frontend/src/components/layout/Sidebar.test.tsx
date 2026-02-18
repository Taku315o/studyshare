import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/home');
  });

  it('renders timetable as an enabled navigation link', () => {
    render(<Sidebar />);

    const timetableLink = screen.getByRole('link', { name: '時間割' });
    expect(timetableLink).toHaveAttribute('href', '/timetable');
  });

  it('renders community as an enabled navigation link', () => {
    render(<Sidebar />);

    const communityLink = screen.getByRole('link', { name: 'コミュニティ' });
    expect(communityLink).toHaveAttribute('href', '/community');
    expect(screen.queryByText('準備中')).not.toBeInTheDocument();
  });

  it('renders mypage link as /me', () => {
    render(<Sidebar />);

    const myPageLink = screen.getByRole('link', { name: 'マイページ' });
    expect(myPageLink).toHaveAttribute('href', '/me');
  });
});
