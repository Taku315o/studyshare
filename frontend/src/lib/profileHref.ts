export function buildProfileHref(targetUserId: string, currentUserId?: string | null) {
  return currentUserId && currentUserId === targetUserId ? '/me' : `/profile/${targetUserId}`;
}
