import { buildProfileHref } from '@/lib/profileHref';

describe('buildProfileHref', () => {
  it('returns /me for the current user', () => {
    expect(buildProfileHref('user-1', 'user-1')).toBe('/me');
  });

  it('returns a profile route for other users', () => {
    expect(buildProfileHref('user-2', 'user-1')).toBe('/profile/user-2');
    expect(buildProfileHref('user-2', null)).toBe('/profile/user-2');
  });
});
