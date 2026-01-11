/**
 * Remove cards with less than 3 characters or null/empty content
 *
 * Usage:
 *   bun run scripts/remove-short-cards.ts           # Run the cleanup
 *   bun run scripts/remove-short-cards.ts --dry-run # Preview without changes
 *
 * Required environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *
 * This script:
 * 1. Fetches all cards
 * 2. Identifies cards with content that is null, empty, or less than 3 characters
 * 3. Deletes the identified cards from the database
 */

import { eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

async function removeShortCards() {
  console.log("Starting short card removal...");
  if (DRY_RUN) {
    console.log("(DRY RUN - no changes will be made)\n");
  } else {
    console.log("");
  }

  // Get all cards to filter client-side (since we need to check trimmed length)
  const allCards = await db.query.cards.findMany();

  // Filter cards with less than 3 characters after trimming
  const cardsToRemove = allCards.filter((card) => {
    const trimmedContent = card.content?.trim() || "";
    return trimmedContent.length < 3;
  });

  if (cardsToRemove.length === 0) {
    console.log("No cards need to be removed. All cards have valid content!");
    return;
  }

  console.log(`Found ${cardsToRemove.length} cards to remove:\n`);

  // Preview some cards that will be removed
  const previewCount = Math.min(10, cardsToRemove.length);
  for (let i = 0; i < previewCount; i++) {
    const card = cardsToRemove[i];
    const contentPreview = card.content
      ? `"${card.content.slice(0, 50).replace(/\n/g, " ")}"`
      : "(empty)";
    console.log(
      `  - ${card.id}: ${contentPreview} (length: ${card.content?.trim().length || 0})`,
    );
  }

  if (cardsToRemove.length > previewCount) {
    console.log(`  ... and ${cardsToRemove.length - previewCount} more`);
  }

  console.log("");

  if (DRY_RUN) {
    console.log(`Would remove ${cardsToRemove.length} cards.`);
  } else {
    // Delete the cards
    let deleted = 0;
    let failed = 0;

    for (const card of cardsToRemove) {
      try {
        await db.delete(cards).where(eq(cards.id, card.id));
        deleted++;
      } catch (err) {
        console.error(`  Failed to delete card ${card.id}:`, err);
        failed++;
      }
    }

    console.log("\n--- Cleanup Complete ---");
    console.log(`Deleted: ${deleted}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${cardsToRemove.length}`);
  }
}

// Run the script
removeShortCards()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  });
