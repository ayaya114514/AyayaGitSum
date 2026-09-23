export function usernameFromHash(hash: string): string {
  const match = hash.match(/^#\/user\/([^/?#]+)/);
  if (!match) {
    return "";
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

export function userHash(username: string): string {
  return `/user/${encodeURIComponent(username)}`;
}
