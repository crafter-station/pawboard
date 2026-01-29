import { gateway } from "@ai-sdk/gateway";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { tools } from "@/ai/tools";
import { getSessionCards } from "@/db/queries";
import prompt from "./prompt.md";

interface RequestBody {
  messages: UIMessage[];
  sessionId: string;
  userId: string;
}

function buildCanvasContext(
  cards: Array<{
    id: string;
    content: string;
    x: number;
    y: number;
    color: string;
  }>,
): string {
  if (cards.length === 0) {
    return "\n\n## Current Canvas State\n\nThe canvas is empty. No cards exist yet.";
  }

  // Calculate canvas bounds
  const minX = Math.min(...cards.map((c) => c.x));
  const maxX = Math.max(...cards.map((c) => c.x));
  const minY = Math.min(...cards.map((c) => c.y));
  const maxY = Math.max(...cards.map((c) => c.y));

  const cardList = cards
    .map(
      (c) =>
        `- ID: ${c.id} | Position: (${Math.round(c.x)}, ${Math.round(c.y)}) | Color: ${c.color} | Content: "${c.content.substring(0, 60)}${c.content.length > 60 ? "..." : ""}"`,
    )
    .join("\n");

  return `

## Current Canvas State

**${cards.length} card(s)** on the canvas.
**Bounds:** X from ${Math.round(minX)} to ${Math.round(maxX)}, Y from ${Math.round(minY)} to ${Math.round(maxY)}

### Cards:
${cardList}

### Positioning Tips:
- Cards are ~224px wide and ~160px tall
- To avoid overlap, space cards at least 250px apart horizontally or 180px vertically
- When creating multiple cards, calculate positions based on existing cards to avoid overlap
- For vertical layouts: increment Y by ~180px for each card
- For horizontal layouts: increment X by ~250px for each card`;
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId, userId } = (await req.json()) as RequestBody;

    if (!sessionId || !userId) {
      return Response.json(
        { error: "sessionId and userId are required" },
        { status: 400 },
      );
    }

    // Fetch current cards to provide canvas context
    const currentCards = await getSessionCards(sessionId);
    const canvasContext = buildCanvasContext(currentCards);

    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: gateway("gpt-4o-mini"),
      system: prompt + canvasContext,
      messages: modelMessages,
      tools: tools({ sessionId, userId }),
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
