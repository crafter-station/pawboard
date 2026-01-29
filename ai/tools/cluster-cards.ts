import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { clusterCards as clusterCardsAction } from "@/app/actions";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import description from "./cluster-cards.md";
import type { ToolParams } from "./index";

const inputSchema = z.object({
  confirm: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Confirmation to proceed with clustering. Always true when called.",
    ),
});

export const clusterCardsTool = ({
  sessionId,
  userId,
  userRole: _userRole,
}: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async () => {
      try {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return "Error: Session not found";
        }

        if (session.isLocked) {
          return "Error: Cannot cluster cards in a locked session";
        }

        const result = await clusterCardsAction(sessionId, userId);

        if (result.error) {
          return `Error: ${result.error}`;
        }

        return `Successfully clustered ${result.cardsProcessed} cards into ${result.clusterCount} groups. Cards with similar content are now positioned near each other.`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to cluster cards";
        return `Error clustering cards: ${message}`;
      }
    },
  });
