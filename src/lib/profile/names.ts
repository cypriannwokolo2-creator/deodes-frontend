/**
 * Identity display helpers (T006-T008).
 *
 * Rule: displayName → @username → null (never invent "Anonymous" here;
 * callers decide their own empty-state copy). Wallet addresses and user IDs
 * are not names and must never be rendered as such.
 */

interface Identity {
  displayName?: string | null;
  username?: string | null;
  userName?: string | null;
}

export function displayNameOf(user: Identity | null | undefined): string | null {
  if (!user) return null;
  if (user.displayName && user.displayName.trim()) return user.displayName;
  const handle = user.username ?? user.userName;
  if (handle && handle.trim()) return `@${handle.trim().replace(/^@+/, "")}`;
  return null;
}

export function avatarInitialOf(
  user: (Identity & { walletAddress?: string | null }) | null | undefined,
): string {
  const name = displayNameOf(user);
  if (name) return name.replace(/^@/, "").charAt(0).toUpperCase();
  return "U";
}
