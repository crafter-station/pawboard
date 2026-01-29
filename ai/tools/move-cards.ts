import { tool } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import type { Card } from "@/db/schema";
import { cards, sessions } from "@/db/schema";
import { canMoveCard } from "@/lib/permissions";
import { broadcastCardEvent } from "@/lib/supabase/broadcast";
import type { ToolParams } from "./index";
import description from "./move-cards.md";

const SPACING_X = 250;
const SPACING_Y = 180;

type Layout = "grid" | "horizontal" | "vertical" | "diagonal" | "circle";

function calculatePositions(
  cardList: Pick<Card, "id">[],
  targetX: number,
  targetY: number,
  layout: Layout,
): Array<{ id: string; x: number; y: number }> {
  const count = cardList.length;

  if (count === 1) {
    return [{ id: cardList[0].id, x: targetX, y: targetY }];
  }

  switch (layout) {
    case "horizontal":
      return cardList.map((card, i) => ({
        id: card.id,
        x: targetX + i * SPACING_X - ((count - 1) * SPACING_X) / 2,
        y: targetY,
      }));

    case "vertical":
      return cardList.map((card, i) => ({
        id: card.id,
        x: targetX,
        y: targetY + i * SPACING_Y - ((count - 1) * SPACING_Y) / 2,
      }));

    case "diagonal":
      return cardList.map((card, i) => ({
        id: card.id,
        x: targetX + i * SPACING_X - ((count - 1) * SPACING_X) / 2,
        y: targetY + i * SPACING_Y - ((count - 1) * SPACING_Y) / 2,
      }));

    case "circle": {
      const radius = Math.max(SPACING_X, (count * SPACING_X) / (2 * Math.PI));
      return cardList.map((card, i) => {
        const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
        return {
          id: card.id,
          x: targetX + Math.cos(angle) * radius,
          y: targetY + Math.sin(angle) * radius,
        };
      });
    }

    case "grid":
    default: {
      const cols = Math.ceil(Math.sqrt(count));
      return cardList.map((card, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rows = Math.ceil(count / cols);
        return {
          id: card.id,
          x: targetX + col * SPACING_X - ((cols - 1) * SPACING_X) / 2,
          y: targetY + row * SPACING_Y - ((rows - 1) * SPACING_Y) / 2,
        };
      });
    }
  }
}

const inputSchema = z.object({
  cardIds: z.array(z.string()).describe("Array of card IDs to move"),
  x: z.number().describe("Target X position (center of the arrangement)"),
  y: z.number().describe("Target Y position (center of the arrangement)"),
  layout: z
    .enum(["grid", "horizontal", "vertical", "diagonal", "circle"])
    .optional()
    .describe(
      "Layout pattern for multiple cards: 'horizontal' (row), 'vertical' (column), 'grid' (square pattern), 'diagonal' (staircase), 'circle' (circular arrangement). Defaults to grid.",
    ),
});

export const moveCardsTool = ({ sessionId, userId }: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ cardIds, x, y, layout = "grid" }) => {
      try {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return "Error: Session not found";
        }

        const cardsToMove = await db.query.cards.findMany({
          where: and(
            inArray(cards.id, cardIds),
            eq(cards.sessionId, sessionId),
          ),
        });

        if (cardsToMove.length === 0) {
          return "Error: No cards found with the provided IDs";
        }

        // Filter cards user has permission to move
        const movableCards = cardsToMove.filter((card) =>
          canMoveCard(session, card, userId),
        );

        if (movableCards.length === 0) {
          return "Error: You don't have permission to move these cards";
        }

        // Calculate positions based on layout
        const positions = calculatePositions(movableCards, x, y, layout);

        // Update each card position
        for (const pos of positions) {
          await db
            .update(cards)
            .set({ x: pos.x, y: pos.y, updatedAt: new Date() })
            .where(eq(cards.id, pos.id));
        }

        // Broadcast position changes to realtime so all clients see the moves
        await broadcastCardEvent(sessionId, {
          type: "cards:cluster",
          positions,
        });

        const layoutDesc =
          layout === "grid"
            ? "in a grid"
            : layout === "horizontal"
              ? "horizontally"
              : layout === "vertical"
                ? "vertically"
                : layout === "diagonal"
                  ? "diagonally"
                  : "in a circle";
        return `Successfully arranged ${movableCards.length} card(s) ${layoutDesc} at position (${x}, ${y})`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to move cards";
        return `Error moving cards: ${message}`;
      }
    },
  });
