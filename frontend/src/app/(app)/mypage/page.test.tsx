import MyPageRedirectPage from './page';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('MyPageRedirectPage', () => {
  it('redirects to /me', () => {
    MyPageRedirectPage();
    expect(redirect).toHaveBeenCalledWith('/me');
  });
});
