/**
 * Backfill embeddings for all cards with content
 *
 * Usage:
 *   bun run scripts/backfill-embeddings.ts           # Run the backfill
 *   bun run scripts/backfill-embeddings.ts --dry-run # Preview without changes
 *
 * Required environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - OPENAI_API_KEY: OpenAI API key for embeddings
 *
 * This script:
 * 1. Fetches all cards with non-empty content that don't have embeddings
 * 2. Generates embeddings in batches using OpenAI
 * 3. Updates the cards in the database
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { generateEmbeddings } from "@/lib/embeddings";
import { extractTextFromTiptap, isContentEmpty } from "@/lib/tiptap-utils";

const BATCH_SIZE = 50; // Process 50 cards at a time to avoid rate limits
const DRY_RUN = process.argv.includes("--dry-run");

async function backfillEmbeddings() {
  console.log("Starting embedding backfill...");
  if (DRY_RUN) {
    console.log("(DRY RUN - no changes will be made)\n");
  } else {
    console.log("");
  }

  // Get all cards without embeddings
  const cardsToProcess = await db.query.cards.findMany({
    where: isNull(cards.embedding),
  });

  // Filter out cards with empty content
  const cardsWithContent = cardsToProcess.filter(
    (card) => !isContentEmpty(card.content),
  );

  if (cardsWithContent.length === 0) {
    console.log("No cards need embedding backfill. All done!");
    return;
  }

  console.log(`Found ${cardsWithContent.length} cards to process.\n`);

  // Process in batches
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < cardsWithContent.length; i += BATCH_SIZE) {
    const batch = cardsWithContent.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(cardsWithContent.length / BATCH_SIZE);

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} (${batch.length} cards)...`,
    );

    try {
      if (DRY_RUN) {
        // In dry run, just count and preview
        console.log(`  Would process ${batch.length} cards:`);
        for (const card of batch.slice(0, 3)) {
          const textContent = extractTextFromTiptap(card.content);
          const preview = textContent.slice(0, 50).replace(/\n/g, " ");
          console.log(
            `    - ${card.id}: "${preview}${textContent.length > 50 ? "..." : ""}"`,
          );
        }
        if (batch.length > 3) {
          console.log(`    ... and ${batch.length - 3} more`);
        }
        processed += batch.length;
      } else {
        // Generate embeddings for the batch
        const texts = batch.map((card) => extractTextFromTiptap(card.content));
        const embeddings = await generateEmbeddings(texts);

        // Update each card with its embedding
        for (let j = 0; j < batch.length; j++) {
          const card = batch[j];
          const embedding = embeddings[j];

          try {
            await db
              .update(cards)
              .set({ embedding })
              .where(eq(cards.id, card.id));

            processed++;
          } catch (err) {
            console.error(`  Failed to update card ${card.id}:`, err);
            failed++;
          }
        }

        console.log(
          `  Batch ${batchNumber} complete. Progress: ${processed}/${cardsWithContent.length}`,
        );
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < cardsWithContent.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`  Batch ${batchNumber} failed:`, err);
      failed += batch.length;
    }
  }

  console.log("\n--- Backfill Complete ---");
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${cardsWithContent.length}`);
}

// Run the script
backfillEmbeddings()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  });
