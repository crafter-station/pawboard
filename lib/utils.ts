import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CAT_AVATARS = [
  "/cat-blue.svg",
  "/cat-green.svg",
  "/cat-purple.svg",
  "/cat-yellow.svg",
];

/**
 * Generate a consistent avatar based on a string (username or visitorId)
 * The same input will always return the same avatar
 */
export function getAvatarForUser(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash = hash & hash;
  }
  return CAT_AVATARS[Math.abs(hash) % CAT_AVATARS.length];
}

/**
 * Generate a DiceBear avatar URL for a user.
 * Uses "adventurer" style for fun, consistent avatars.
 */
export function getDiceBearAvatar(
  userId: string,
  style: "adventurer" | "bottts" | "fun-emoji" = "adventurer",
): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(userId)}`;
}

/**
 * Format a date as relative time (e.g., "2m ago", "1h ago", "3d ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
