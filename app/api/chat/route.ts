import type { UIMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, sessionParticipants } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/ai/context-builder";
import {
  createCardSchema,
  executeCreateCard,
  executeGetAllCards,
  executeGetCardsByUser,
  executeGrepFiles,
  executeReadFile,
  executeSearchCards,
  executeUpdateCard,
  getAllCardsSchema,
  getCardsByUserSchema,
  grepFilesSchema,
  readFileSchema,
  searchCardsSchema,
  type ToolContext,
  updateCardSchema,
} from "@/lib/ai/tools";

export async function POST(req: Request) {
  try {
    const body: {
      messages: UIMessage[];
      sessionId: string;
      userId: string;
      selectedCardId?: string;
    } = await req.json();

    const { messages, sessionId, userId } = body;

    // Read selectedCardId from header (dynamic, sent per-request) or fallback to body
    const selectedCardIdFromHeader = req.headers.get("X-Selected-Card-Id");
    const selectedCardId =
      selectedCardIdFromHeader && selectedCardIdFromHeader !== ""
        ? selectedCardIdFromHeader
        : body.selectedCardId;

    // Validate required fields
    if (!sessionId) {
      return Response.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }
    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "messages array is required" },
        { status: 400 },
      );
    }

    // Verify user is a session participant
    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, sessionId),
      ),
    });

    if (!participant) {
      return Response.json(
        { error: "You must be a participant in this session" },
        { status: 403 },
      );
    }

    // Fetch all cards for the session
    const sessionCards = await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
    });

    // Build context for tools
    const toolContext: ToolContext = {
      sessionId,
      userId,
      selectedCardId,
      cards: sessionCards,
    };

    // Build system prompt with context
    const systemPrompt = await buildSystemPrompt({
      sessionId,
      userId,
      cards: sessionCards,
      selectedCardId,
    });

    // Convert UIMessages to ModelMessages for the AI model
    const modelMessages = await convertToModelMessages(messages);

    // Debug logging
    console.log(
      "[chat] Starting streamText with",
      modelMessages.length,
      "messages",
    );
    console.log("[chat] selectedCardId:", selectedCardId || "(none)", {
      fromHeader: selectedCardIdFromHeader || "(not set)",
      fromBody: body.selectedCardId || "(not set)",
    });
    console.log("[chat] System prompt length:", systemPrompt.length);
    console.log(
      "[chat] Selected card section included:",
      systemPrompt.includes("### Selected Card"),
    );
    if (selectedCardId) {
      const selectedCard = sessionCards.find((c) => c.id === selectedCardId);
      console.log("[chat] Selected card found:", !!selectedCard);
      if (selectedCard) {
        console.log(
          "[chat] Selected card preview:",
          selectedCard.content.slice(0, 100),
        );
      }
    }

    // Stream the response with tools
    const result = streamText({
      model: "anthropic/claude-sonnet-4.5",
      system: systemPrompt,
      messages: modelMessages,
      tools: {
        create_card: {
          description:
            "Create a new idea card on the board. Use this when the user wants to add a new idea or note.",
          inputSchema: createCardSchema,
          execute: async (params: { content: string; color?: string }) => {
            console.log("[chat] create_card tool called with:", params);
            return executeCreateCard(params, toolContext);
          },
        },
        update_card: {
          description:
            "Update the content of the currently selected card. Only works when exactly one card is selected.",
          inputSchema: updateCardSchema,
          execute: async (params: { content: string }) =>
            executeUpdateCard(params, toolContext),
        },
        grep_files: {
          description:
            "Search for information across all uploaded files using semantic search.",
          inputSchema: grepFilesSchema,
          execute: async (params: { query: string; limit?: number }) =>
            executeGrepFiles(
              { ...params, limit: params.limit ?? 5 },
              toolContext,
            ),
        },
        read_file: {
          description:
            "Read the complete contents of a specific uploaded file by name.",
          inputSchema: readFileSchema,
          execute: async (params: { filename: string }) =>
            executeReadFile(params, toolContext),
        },

        search_cards: {
          description:
            "Search for cards on the board using semantic search. Use this to find cards related to a specific topic or query.",
          inputSchema: searchCardsSchema,
          execute: async (params: { query: string; limit?: number }) =>
            executeSearchCards(
              { ...params, limit: params.limit ?? 5 },
              toolContext,
            ),
        },
        get_all_cards: {
          description:
            "Get all cards on the board. Use this when you need to see everything on the board, summarize the board content, or get an overview of all ideas.",
          inputSchema: getAllCardsSchema,
          execute: async () => executeGetAllCards({}, toolContext),
        },
        get_cards_by_user: {
          description:
            "Get all cards created by a specific user. Use this to see what a particular person has contributed to the board.",
          inputSchema: getCardsByUserSchema,
          execute: async (params: { username: string }) =>
            executeGetCardsByUser(params, toolContext),
        },
      },
      temperature: 0.7,
      stopWhen: stepCountIs(10),
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
