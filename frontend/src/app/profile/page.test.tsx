import ProfileRedirectPage from './page';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('ProfileRedirectPage', () => {
  it('redirects to /me', () => {
    ProfileRedirectPage();
    expect(redirect).toHaveBeenCalledWith('/me');
  });
});
