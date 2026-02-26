import { gateway } from "@ai-sdk/gateway";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { tools } from "@/ai/tools";
import { db } from "@/db";
import { getSessionCards } from "@/db/queries";
import type { Card, SessionRole } from "@/db/schema";
import { sessionParticipants, sessions } from "@/db/schema";
import {
  getClientIdentifier,
  rateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { extractTextFromTiptap } from "@/lib/tiptap-utils";
import { chatRequestSchema, validateRequest } from "@/lib/validations";
import prompt from "./prompt.md";

function buildCanvasContext(ownCards: Card[], blurredCards?: Card[]): string {
  const totalCards = ownCards.length + (blurredCards?.length ?? 0);

  if (totalCards === 0) {
    return "\n\n## Current Canvas State\n\nThe canvas is empty. No cards exist yet.";
  }

  const allCards = [...ownCards, ...(blurredCards ?? [])];
  // Calculate canvas bounds from all cards (own + blurred) for positioning
  const minX = Math.min(...allCards.map((c) => c.x));
  const maxX = Math.max(...allCards.map((c) => c.x));
  const minY = Math.min(...allCards.map((c) => c.y));
  const maxY = Math.max(...allCards.map((c) => c.y));

  const ownCardList = ownCards
    .map((c) => {
      const textContent = extractTextFromTiptap(c.content);
      return `- ID: ${c.id} | Position: (${Math.round(c.x)}, ${Math.round(c.y)}) | Color: ${c.color} | Content: "${textContent.substring(0, 60)}${textContent.length > 60 ? "..." : ""}"`;
    })
    .join("\n");

  const blurredCount = blurredCards?.length ?? 0;
  const blurredSection =
    blurredCount > 0
      ? `\n\n### Hidden Cards (blur mode active):\n${blurredCount} card(s) from other participants are hidden. Their content is not available, but they occupy the following positions:\n${blurredCards?.map((c) => `- ID: ${c.id} | Position: (${Math.round(c.x)}, ${Math.round(c.y)}) | Color: ${c.color} | Content: [hidden]`).join("\n")}`
      : "";

  return `

## Current Canvas State

**${totalCards} card(s)** on the canvas (${ownCards.length} visible, ${blurredCount} hidden due to blur mode).
**Bounds:** X from ${Math.round(minX)} to ${Math.round(maxX)}, Y from ${Math.round(minY)} to ${Math.round(maxY)}

### Your Cards:
${ownCardList || "No cards from you yet."}${blurredSection}

### Positioning Tips:
- Cards are ~224px wide and ~160px tall
- To avoid overlap, space cards at least 250px apart horizontally or 180px vertically
- When creating multiple cards, calculate positions based on existing cards to avoid overlap
- For vertical layouts: increment Y by ~180px for each card
- For horizontal layouts: increment X by ~250px for each card`;
}

export async function POST(req: Request) {
  // Rate limit check
  const clientId = getClientIdentifier(req);
  const { success, reset, limit, remaining } = await rateLimit(clientId, "ai");
  if (!success) {
    return rateLimitResponse(reset, limit, remaining);
  }

  try {
    // Validate request body
    const { data, error: validationError } = await validateRequest(
      req,
      chatRequestSchema,
    );
    if (validationError) return validationError;

    const { messages, sessionId, userId, fingerprintId } = data;

    // Type assertion - messages validated to be array
    const typedMessages = messages as unknown as UIMessage[];

    // Get user role in session
    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, sessionId),
      ),
    });
    const userRole: SessionRole =
      (participant?.role as SessionRole) ?? "participant";

    // Fetch session to check blur status, and current cards for context
    const [session, currentCards] = await Promise.all([
      db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) }),
      getSessionCards(sessionId),
    ]);

    // When blur is active, only show own cards' content to the AI.
    // Blurred cards are listed as metadata-only (position, color) with no content.
    let canvasContext: string;
    if (session?.isBlurred) {
      const isOwn = (c: Card) =>
        c.createdById === userId ||
        (fingerprintId != null && c.createdById === fingerprintId);
      const ownCards = currentCards.filter(isOwn);
      const blurredCards = currentCards.filter((c) => !isOwn(c));
      canvasContext = buildCanvasContext(ownCards, blurredCards);
    } else {
      canvasContext = buildCanvasContext(currentCards);
    }

    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(typedMessages);

    const result = streamText({
      model: gateway("gpt-4o-mini"),
      system: prompt + canvasContext,
      messages: modelMessages,
      tools: tools({ sessionId, userId, userRole }),
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
