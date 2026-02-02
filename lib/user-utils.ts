import { clerkClient } from "@clerk/nextjs/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Check if a user ID is a Clerk user ID.
 * Clerk IDs start with "user_" prefix.
 */
export function isClerkUserId(userId: string): boolean {
  return userId.startsWith("user_");
}

/**
 * Server-side utility to resolve multiple user IDs to usernames.
 * Handles both Clerk IDs (fetched from Clerk API) and fingerprint IDs (fetched from DB).
 *
 * @param userIds - Array of user IDs (can be mixed Clerk and fingerprint IDs)
 * @returns Map of userId -> username
 */
export async function resolveUsernames(
  userIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) {
    return result;
  }

  const clerkIds = uniqueIds.filter(isClerkUserId);
  const fingerprintIds = uniqueIds.filter((id) => !isClerkUserId(id));

  // Fetch Clerk users in batch
  if (clerkIds.length > 0) {
    try {
      const client = await clerkClient();
      const clerkUsers = await client.users.getUserList({
        userId: clerkIds,
      });
      for (const user of clerkUsers.data) {
        result.set(user.id, user.firstName || user.username || "Anonymous");
      }
    } catch (e) {
      console.error("Failed to fetch Clerk users:", e);
    }
    // Mark any failed/missing Clerk IDs as "Anonymous"
    for (const id of clerkIds) {
      if (!result.has(id)) {
        result.set(id, "Anonymous");
      }
    }
  }

  // Fetch fingerprint users from DB
  if (fingerprintIds.length > 0) {
    try {
      const dbUsers = await db.query.users.findMany({
        where: inArray(users.id, fingerprintIds),
      });
      for (const user of dbUsers) {
        result.set(user.id, user.username);
      }
    } catch (e) {
      console.error("Failed to fetch fingerprint users:", e);
    }
    // Mark any missing fingerprints as "Anonymous"
    for (const id of fingerprintIds) {
      if (!result.has(id)) {
        result.set(id, "Anonymous");
      }
    }
  }

  return result;
}

/**
 * Get a single username by user ID.
 * Convenience wrapper around resolveUsernames for single lookups.
 */
export async function getUsername(userId: string): Promise<string> {
  const map = await resolveUsernames([userId]);
  return map.get(userId) ?? "Anonymous";
}
