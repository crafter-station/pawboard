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
