import { tool } from "ai";
import { cosineDistance, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { extractTextFromTiptap, isContentEmpty } from "@/lib/tiptap-utils";
import description from "./find-similar.md";
import type { ToolParams } from "./index";

const inputSchema = z.object({
  query: z.string().optional().describe("Text query to find similar cards"),
  cardId: z.string().optional().describe("Card ID to find cards similar to"),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of results (default 5)"),
});

export const findSimilarTool = ({ sessionId }: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ query, cardId, limit = 5 }) => {
      try {
        if (!query && !cardId) {
          return "Error: Please provide either a text query or a card ID to find similar cards";
        }

        let embedding: number[];

        if (cardId) {
          const sourceCard = await db.query.cards.findFirst({
            where: eq(cards.id, cardId),
          });

          if (!sourceCard) {
            return `Error: Card with ID "${cardId}" not found`;
          }

          if (
            !sourceCard.embedding ||
            (Array.isArray(sourceCard.embedding) &&
              sourceCard.embedding.length === 0)
          ) {
            // Generate embedding for the card content
            if (isContentEmpty(sourceCard.content)) {
              return "Error: Cannot generate embedding for card without content";
            }
            const textContent = extractTextFromTiptap(sourceCard.content);
            embedding = await generateEmbedding(textContent);
          } else {
            embedding = sourceCard.embedding as number[];
          }
        } else if (query) {
          embedding = await generateEmbedding(query);
        } else {
          return "Error: No valid input provided";
        }

        // Find similar cards using cosine similarity
        const similarity = sql<number>`1 - (${cosineDistance(cards.embedding, embedding)})`;

        const similarCards = await db
          .select({
            id: cards.id,
            content: cards.content,
            similarity,
          })
          .from(cards)
          .where(eq(cards.sessionId, sessionId))
          .orderBy(desc(similarity))
          .limit(limit + 1); // +1 to potentially exclude source card

        // Filter out the source card if searching by cardId
        const results = cardId
          ? similarCards.filter((c) => c.id !== cardId).slice(0, limit)
          : similarCards.slice(0, limit);

        // Filter cards with meaningful similarity (> 0.3)
        const meaningfulResults = results.filter(
          (c) => c.similarity && c.similarity > 0.3,
        );

        if (meaningfulResults.length === 0) {
          return "No similar cards found. The cards on this board may cover different topics.";
        }

        const resultText = meaningfulResults
          .map((r, i) => {
            const textContent = r.content
              ? extractTextFromTiptap(r.content)
              : "";
            return `${i + 1}. [${Math.round((r.similarity || 0) * 100)}% match] ${textContent.substring(0, 80)}${textContent.length > 80 ? "..." : ""} (ID: ${r.id})`;
          })
          .join("\n");

        return `Found ${meaningfulResults.length} similar card(s):\n\n${resultText}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to find similar";
        return `Error finding similar cards: ${message}`;
      }
    },
  });
