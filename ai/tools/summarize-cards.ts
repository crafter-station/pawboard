import { createGroq } from "@ai-sdk/groq";
import { generateText, tool } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import type { Card } from "@/db/schema";
import { cards, sessions } from "@/db/schema";
import { extractTextFromTiptap, isContentEmpty } from "@/lib/tiptap-utils";
import type { ToolParams } from "./index";
import description from "./summarize-cards.md";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const inputSchema = z.object({
  cardIds: z
    .array(z.string())
    .optional()
    .describe(
      "Optional array of specific card IDs to summarize. If not provided, summarizes all cards in the session.",
    ),
});

export const summarizeCardsTool = ({
  sessionId,
  userId,
  userRole: _userRole,
}: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ cardIds }) => {
      try {
        let cardsToSummarize: Card[];

        if (cardIds && cardIds.length > 0) {
          cardsToSummarize = await db.query.cards.findMany({
            where: and(
              inArray(cards.id, cardIds),
              eq(cards.sessionId, sessionId),
            ),
          });
        } else {
          cardsToSummarize = await db.query.cards.findMany({
            where: eq(cards.sessionId, sessionId),
          });
        }

        // When blur is active, only summarize the user's own cards
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });
        const totalCount = cardsToSummarize.length;
        let hiddenCount = 0;
        if (session?.isBlurred) {
          const ownCards = cardsToSummarize.filter(
            (c) => c.createdById === userId,
          );
          hiddenCount = totalCount - ownCards.length;
          cardsToSummarize = ownCards;
        }

        const cardsWithContent = cardsToSummarize.filter(
          (c) => !isContentEmpty(c.content),
        );

        if (cardsWithContent.length === 0) {
          const hiddenMsg =
            hiddenCount > 0
              ? ` (${hiddenCount} other card(s) are hidden due to blur mode)`
              : "";
          return `Error: No cards with content found to summarize${hiddenMsg}`;
        }

        const cardContents = cardsWithContent
          .map((c, i) => `${i + 1}. ${extractTextFromTiptap(c.content)}`)
          .join("\n");

        const prompt = `You are summarizing ideas from a brainstorming board. Here are the cards:

${cardContents}

Provide a concise summary that:
1. Identifies main themes or categories
2. Highlights key ideas
3. Notes any patterns or connections

Keep the summary clear and actionable. Use bullet points where appropriate.`;

        const { text: summary } = await generateText({
          model: groq("llama-3.3-70b-versatile"),
          prompt,
          temperature: 0.3,
        });

        const hiddenMsg =
          hiddenCount > 0
            ? ` (${hiddenCount} other card(s) are hidden due to blur mode and not included)`
            : "";
        return `Summary of ${cardsWithContent.length} card(s)${hiddenMsg}:\n\n${summary}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to summarize cards";
        return `Error summarizing cards: ${message}`;
      }
    },
  });
