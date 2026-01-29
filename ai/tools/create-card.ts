import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import type { Card } from "@/db/schema";
import { cards, sessions } from "@/db/schema";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";
import { generateCardId } from "@/lib/nanoid";
import { canAddCard } from "@/lib/permissions";
import { broadcastCardEvent } from "@/lib/supabase/broadcast";
import description from "./create-card.md";
import type { ToolParams } from "./index";

const CARD_WIDTH = 224;
const CARD_HEIGHT = 160;
const SPACING_X = 250;
const SPACING_Y = 180;

function findNonOverlappingPosition(
  existingCards: Pick<Card, "x" | "y">[],
  preferredX?: number,
  preferredY?: number,
): { x: number; y: number } {
  // If no existing cards, use preferred or center
  if (existingCards.length === 0) {
    return { x: preferredX ?? 0, y: preferredY ?? 0 };
  }

  // If position is explicitly provided, use it
  if (preferredX !== undefined && preferredY !== undefined) {
    return { x: preferredX, y: preferredY };
  }

  // Find bounds of existing cards
  const minX = Math.min(...existingCards.map((c) => c.x));
  const maxX = Math.max(...existingCards.map((c) => c.x));
  const minY = Math.min(...existingCards.map((c) => c.y));
  const maxY = Math.max(...existingCards.map((c) => c.y));

  // Helper to check if a position overlaps with any card
  const overlaps = (testX: number, testY: number) =>
    existingCards.some(
      (card) =>
        Math.abs(card.x - testX) < CARD_WIDTH + 20 &&
        Math.abs(card.y - testY) < CARD_HEIGHT + 20,
    );

  // Try positions to the right, then below, then left, then above
  const candidates = [
    { x: maxX + SPACING_X, y: minY }, // Right of rightmost
    { x: minX, y: maxY + SPACING_Y }, // Below bottommost
    { x: minX - SPACING_X, y: minY }, // Left of leftmost
    { x: minX, y: minY - SPACING_Y }, // Above topmost
  ];

  for (const pos of candidates) {
    if (!overlaps(pos.x, pos.y)) {
      return pos;
    }
  }

  // Fallback: spiral outward from center of existing cards
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  for (let radius = 1; radius <= 10; radius++) {
    for (let angle = 0; angle < 8; angle++) {
      const x = centerX + Math.cos((angle * Math.PI) / 4) * radius * SPACING_X;
      const y = centerY + Math.sin((angle * Math.PI) / 4) * radius * SPACING_Y;
      if (!overlaps(x, y)) {
        return { x, y };
      }
    }
  }

  // Ultimate fallback: place below all cards
  return { x: centerX, y: maxY + SPACING_Y * 2 };
}

const inputSchema = z.object({
  content: z.string().describe("The text content of the card"),
  color: z
    .string()
    .optional()
    .describe(
      "Optional hex color for the card (e.g., #fef08a). If not provided, a random color will be chosen.",
    ),
  x: z
    .number()
    .optional()
    .describe(
      "X position on the canvas. If not provided, an optimal non-overlapping position will be found automatically.",
    ),
  y: z
    .number()
    .optional()
    .describe(
      "Y position on the canvas. If not provided, an optimal non-overlapping position will be found automatically.",
    ),
});

export const createCardTool = ({ sessionId, userId }: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ content, color, x, y }) => {
      try {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return "Error: Session not found";
        }

        if (!canAddCard(session)) {
          return "Error: Session is locked. Cannot add new cards.";
        }

        // Fetch existing cards to find a non-overlapping position
        const existingCards = await db.query.cards.findMany({
          where: eq(cards.sessionId, sessionId),
          columns: { x: true, y: true },
        });

        const allColors = [...LIGHT_COLORS, ...DARK_COLORS];
        const cardColor =
          color || allColors[Math.floor(Math.random() * allColors.length)];

        const cardId = generateCardId();
        const position = findNonOverlappingPosition(existingCards, x, y);
        const cardX = position.x;
        const cardY = position.y;

        const [newCard] = await db
          .insert(cards)
          .values({
            id: cardId,
            sessionId,
            content,
            color: cardColor,
            x: cardX,
            y: cardY,
            createdById: userId,
          })
          .returning();

        // Broadcast to realtime so all clients see the new card
        await broadcastCardEvent(sessionId, {
          type: "card:add",
          card: newCard,
        });

        return `Successfully created card with ID: ${newCard.id}. Content: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create card";
        return `Error creating card: ${message}`;
      }
    },
  });
