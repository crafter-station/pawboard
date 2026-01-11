import { createGroq } from "@ai-sdk/groq";
import type { UIMessage } from "ai";
import { convertToModelMessages, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, sessionParticipants } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/ai/context-builder";
import {
  createCardSchema,
  executeCreateCard,
  executeGrepFiles,
  executeListFiles,
  executeReadFile,
  executeSummarizeContext,
  executeUpdateCard,
  grepFilesSchema,
  listFilesSchema,
  readFileSchema,
  summarizeContextSchema,
  type ToolContext,
  updateCardSchema,
} from "@/lib/ai/tools";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Use a model that supports tool calling
const MODEL = "llama-3.3-70b-versatile";

export async function POST(req: Request) {
  try {
    const {
      messages,
      sessionId,
      userId,
      selectedCardId,
    }: {
      messages: UIMessage[];
      sessionId: string;
      userId: string;
      selectedCardId?: string;
    } = await req.json();

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

    console.log(
      "[chat] Starting streamText with",
      modelMessages.length,
      "messages",
    );
    console.log(
      "[chat] Tool context:",
      JSON.stringify({ sessionId, userId, selectedCardId }),
    );

    // Stream the response with tools
    const result = streamText({
      model: groq(MODEL),
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
        list_files: {
          description: "List all files that have been uploaded to this board.",
          inputSchema: listFilesSchema,
          execute: async () => executeListFiles({}, toolContext),
        },
        summarize_context: {
          description:
            "Generate a summary of the current board context including cards and/or files.",
          inputSchema: summarizeContextSchema,
          execute: async (params: { focus?: "cards" | "files" | "all" }) =>
            executeSummarizeContext(
              { ...params, focus: params.focus ?? "all" },
              toolContext,
            ),
        },
      },
      temperature: 0.7,
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
