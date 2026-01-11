/**
 * Remove sessions that have no cards
 *
 * Usage:
 *   bun run scripts/remove-empty-sessions.ts           # Run the cleanup
 *   bun run scripts/remove-empty-sessions.ts --dry-run # Preview without changes
 *
 * Required environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *
 * This script:
 * 1. Fetches all sessions
 * 2. For each session, checks if it has any cards
 * 3. Deletes sessions that have zero cards
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards, sessions } from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

async function removeEmptySessions() {
  console.log("Starting empty session removal...");
  if (DRY_RUN) {
    console.log("(DRY RUN - no changes will be made)\n");
  } else {
    console.log("");
  }

  // Get all sessions with their card counts
  const allSessions = await db
    .select({
      id: sessions.id,
      name: sessions.name,
      createdAt: sessions.createdAt,
      cardCount: sql<number>`count(${cards.id})::int`,
    })
    .from(sessions)
    .leftJoin(cards, eq(sessions.id, cards.sessionId))
    .groupBy(sessions.id, sessions.name, sessions.createdAt);

  // Filter sessions with no cards
  const sessionsToRemove = allSessions.filter(
    (session) => session.cardCount === 0,
  );

  if (sessionsToRemove.length === 0) {
    console.log("No empty sessions found. All sessions have cards!");
    return;
  }

  console.log(`Found ${sessionsToRemove.length} empty sessions to remove:\n`);

  // Preview sessions that will be removed
  const previewCount = Math.min(10, sessionsToRemove.length);
  for (let i = 0; i < previewCount; i++) {
    const session = sessionsToRemove[i];
    const createdDate = session.createdAt.toISOString().split("T")[0];
    console.log(
      `  - ${session.id}: "${session.name}" (created: ${createdDate})`,
    );
  }

  if (sessionsToRemove.length > previewCount) {
    console.log(`  ... and ${sessionsToRemove.length - previewCount} more`);
  }

  console.log("");

  if (DRY_RUN) {
    console.log(`Would remove ${sessionsToRemove.length} sessions.`);
  } else {
    // Delete the sessions
    let deleted = 0;
    let failed = 0;

    for (const session of sessionsToRemove) {
      try {
        await db.delete(sessions).where(eq(sessions.id, session.id));
        deleted++;
      } catch (err) {
        console.error(`  Failed to delete session ${session.id}:`, err);
        failed++;
      }
    }

    console.log("\n--- Cleanup Complete ---");
    console.log(`Deleted: ${deleted}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${sessionsToRemove.length}`);
  }
}

// Run the script
removeEmptySessions()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  });
