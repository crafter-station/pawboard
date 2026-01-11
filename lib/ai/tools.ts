import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import type { BoardFile, Card, NewCard } from "@/db/schema";
import { boardFiles, cards, fileChunks } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { generateCardId } from "@/lib/nanoid";

// Context passed to tools during execution
export interface ToolContext {
  sessionId: string;
  userId: string;
  selectedCardId?: string;
  cards: Card[];
}

// Tool parameter schemas
export const createCardSchema = z.object({
  content: z
    .string()
    .describe("The content/text for the new card. Keep it concise."),
  color: z
    .string()
    .optional()
    .describe(
      'Optional hex color for the card (e.g., "#fef08a"). If not specified, a random color will be used.',
    ),
});

export const updateCardSchema = z.object({
  content: z.string().describe("The new content for the selected card"),
});

export const grepFilesSchema = z.object({
  query: z
    .string()
    .describe("The search query - describe what you're looking for"),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum number of results to return (default: 5)"),
});

export const readFileSchema = z.object({
  filename: z.string().describe("The name of the file to read"),
});

export const listFilesSchema = z.object({});

export const summarizeContextSchema = z.object({
  focus: z
    .enum(["cards", "files", "all"])
    .default("all")
    .describe("What to include in the summary: cards only, files only, or all"),
});

// Tool execution functions

export async function executeCreateCard(
  params: z.infer<typeof createCardSchema>,
  context: ToolContext,
) {
  console.log("[create_card] Tool called with params:", JSON.stringify(params));
  console.log(
    "[create_card] Context:",
    JSON.stringify({ sessionId: context.sessionId, userId: context.userId }),
  );

  const { content, color } = params;
  const { sessionId, userId, cards: existingCards } = context;

  // Calculate position - place near existing cards with slight offset
  let centerX = 0;
  let centerY = 0;

  if (existingCards.length > 0) {
    // Calculate the center of all existing cards
    const sumX = existingCards.reduce((sum, card) => sum + card.x, 0);
    const sumY = existingCards.reduce((sum, card) => sum + card.y, 0);
    centerX = sumX / existingCards.length;
    centerY = sumY / existingCards.length;
  }

  // Add random offset from center (within 200px range)
  const offsetRange = 200;
  const x = centerX + (Math.random() * offsetRange - offsetRange / 2);
  const y = centerY + (Math.random() * offsetRange - offsetRange / 2);

  const cardId = generateCardId();
  const defaultColors = [
    "#fef08a", // Yellow
    "#fca5a5", // Red
    "#86efac", // Green
    "#93c5fd", // Blue
    "#c4b5fd", // Purple
    "#fdba74", // Orange
  ];
  const cardColor =
    color || defaultColors[Math.floor(Math.random() * defaultColors.length)];

  const newCard: NewCard = {
    id: cardId,
    sessionId,
    content,
    color: cardColor,
    x,
    y,
    votes: 0,
    votedBy: [],
    reactions: {},
    createdById: userId,
  };

  console.log("[create_card] Inserting card:", JSON.stringify(newCard));

  try {
    const [insertedCard] = await db.insert(cards).values(newCard).returning();
    console.log("[create_card] Successfully inserted card:", insertedCard.id);

    // Generate embedding for the card content (don't block on it)
    generateEmbedding(content)
      .then(async (embedding) => {
        await db
          .update(cards)
          .set({ embedding })
          .where(eq(cards.id, insertedCard.id));
        console.log(
          "[create_card] Generated embedding for card:",
          insertedCard.id,
        );
      })
      .catch((error) => {
        console.error("[create_card] Failed to generate embedding:", error);
      });

    // Return full card data so client can broadcast via realtime
    return {
      success: true,
      card: insertedCard,
      message: `Created card with content: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
    };
  } catch (error) {
    console.error("[create_card] Error inserting card:", error);
    return {
      success: false,
      error: `Failed to create card: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function executeUpdateCard(
  params: z.infer<typeof updateCardSchema>,
  context: ToolContext,
) {
  const { content } = params;
  const { selectedCardId } = context;

  if (!selectedCardId) {
    return {
      success: false,
      error:
        "No card is currently selected. Please select a single card first.",
    };
  }

  try {
    const existingCard = await db.query.cards.findFirst({
      where: eq(cards.id, selectedCardId),
    });

    if (!existingCard) {
      return {
        success: false,
        error: "Selected card not found",
      };
    }

    const [updatedCard] = await db
      .update(cards)
      .set({ content, updatedAt: new Date() })
      .where(eq(cards.id, selectedCardId))
      .returning();

    // Return full card data so client can broadcast via realtime
    return {
      success: true,
      card: updatedCard,
      message: "Updated card content",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update card: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function executeGrepFiles(
  params: z.infer<typeof grepFilesSchema>,
  context: ToolContext,
) {
  const { query, limit } = params;
  const { sessionId } = context;

  try {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Find all completed files for this session
    const sessionFiles = await db.query.boardFiles.findMany({
      where: and(
        eq(boardFiles.sessionId, sessionId),
        eq(boardFiles.ingestionStatus, "completed"),
      ),
    });

    if (sessionFiles.length === 0) {
      return {
        success: true,
        results: [],
        message: "No files have been uploaded and processed yet.",
      };
    }

    const fileIds = sessionFiles.map((f) => f.id);

    // Perform vector similarity search
    const results = await db
      .select({
        id: fileChunks.id,
        fileId: fileChunks.fileId,
        content: fileChunks.content,
        chunkIndex: fileChunks.chunkIndex,
        similarity: sql<number>`1 - (${fileChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
      })
      .from(fileChunks)
      .where(sql`${fileChunks.fileId} = ANY(${fileIds})`)
      .orderBy(
        sql`${fileChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`,
      )
      .limit(limit);

    // Join with file metadata
    const enrichedResults = results.map((result) => {
      const file = sessionFiles.find((f) => f.id === result.fileId);
      return {
        filename: file?.filename || "Unknown",
        content: result.content,
        similarity: result.similarity,
        chunkIndex: result.chunkIndex,
      };
    });

    return {
      success: true,
      results: enrichedResults,
      message: `Found ${enrichedResults.length} relevant excerpts`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      results: [],
    };
  }
}

export async function executeReadFile(
  params: z.infer<typeof readFileSchema>,
  context: ToolContext,
) {
  const { filename } = params;
  const { sessionId } = context;

  try {
    // Find the file
    const file = await db.query.boardFiles.findFirst({
      where: and(
        eq(boardFiles.sessionId, sessionId),
        eq(boardFiles.filename, filename),
      ),
    });

    if (!file) {
      // Try case-insensitive search
      const allFiles = await db.query.boardFiles.findMany({
        where: eq(boardFiles.sessionId, sessionId),
      });
      const matchingFile = allFiles.find(
        (f) => f.filename.toLowerCase() === filename.toLowerCase(),
      );

      if (!matchingFile) {
        const fileList = allFiles.map((f) => f.filename).join(", ");
        return {
          success: false,
          error: `File "${filename}" not found. Available files: ${fileList || "none"}`,
        };
      }

      return readFileContent(matchingFile);
    }

    return readFileContent(file);
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function readFileContent(file: BoardFile) {
  if (file.ingestionStatus !== "completed") {
    return {
      success: false,
      error: `File "${file.filename}" is still being processed (status: ${file.ingestionStatus})`,
    };
  }

  // Get all chunks in order
  const chunks = await db.query.fileChunks.findMany({
    where: eq(fileChunks.fileId, file.id),
    orderBy: [fileChunks.chunkIndex],
  });

  // Reconstruct content from chunks
  const fullContent = chunks.map((c) => c.content).join("\n\n");

  return {
    success: true,
    filename: file.filename,
    mimeType: file.mimeType,
    content: fullContent,
    chunkCount: chunks.length,
  };
}

export async function executeListFiles(
  _params: z.infer<typeof listFilesSchema>,
  context: ToolContext,
) {
  const { sessionId } = context;

  try {
    const files = await db.query.boardFiles.findMany({
      where: eq(boardFiles.sessionId, sessionId),
      orderBy: [desc(boardFiles.uploadedAt)],
    });

    if (files.length === 0) {
      return {
        success: true,
        files: [],
        message: "No files have been uploaded to this board yet.",
      };
    }

    const fileList = files.map((f) => ({
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      status: f.ingestionStatus,
      uploadedAt: f.uploadedAt.toISOString(),
    }));

    return {
      success: true,
      files: fileList,
      message: `Found ${files.length} file(s) in this board`,
    };
  } catch (error) {
    return {
      success: false,
      files: [],
      error: `Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function executeSummarizeContext(
  params: z.infer<typeof summarizeContextSchema>,
  context: ToolContext,
) {
  const { focus } = params;
  const { sessionId, cards: contextCards } = context;

  const summary: {
    cards?: {
      count: number;
      themes: string[];
      samples: string[];
    };
    files?: {
      count: number;
      names: string[];
    };
  } = {};

  try {
    // Summarize cards
    if (focus === "cards" || focus === "all") {
      const cardContents = contextCards
        .filter((c) => c.content && c.content.trim().length > 0)
        .map((c) => c.content);

      summary.cards = {
        count: contextCards.length,
        themes: [],
        samples: cardContents.slice(0, 5).map((c) => c.slice(0, 100)),
      };
    }

    // Summarize files
    if (focus === "files" || focus === "all") {
      const files = await db.query.boardFiles.findMany({
        where: eq(boardFiles.sessionId, sessionId),
      });

      summary.files = {
        count: files.length,
        names: files.map((f) => f.filename),
      };
    }

    return {
      success: true,
      summary,
      message: `Board has ${summary.cards?.count || 0} cards and ${summary.files?.count || 0} files`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to summarize: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Tool definitions for the AI SDK
export const toolDefinitions = {
  create_card: {
    description:
      "Create a new idea card on the board. Use this when the user wants to add a new idea or note.",
    parameters: createCardSchema,
  },
  update_card: {
    description:
      "Update the content of the currently selected card. Only works when exactly one card is selected. Use this to refine, expand, or rewrite card content.",
    parameters: updateCardSchema,
  },
  grep_files: {
    description:
      "Search for information across all uploaded files using semantic search. Returns relevant excerpts from files that match the query.",
    parameters: grepFilesSchema,
  },
  read_file: {
    description:
      "Read the complete contents of a specific uploaded file by name. Use this when you need to see the full content of a file.",
    parameters: readFileSchema,
  },
  list_files: {
    description:
      "List all files that have been uploaded to this board, including their processing status.",
    parameters: listFilesSchema,
  },
  summarize_context: {
    description:
      "Generate a summary of the current board context including cards and/or files. Useful for getting an overview of what's on the board.",
    parameters: summarizeContextSchema,
  },
};

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: unknown,
  context: ToolContext,
): Promise<unknown> {
  switch (toolName) {
    case "create_card":
      return executeCreateCard(
        params as z.infer<typeof createCardSchema>,
        context,
      );
    case "update_card":
      return executeUpdateCard(
        params as z.infer<typeof updateCardSchema>,
        context,
      );
    case "grep_files":
      return executeGrepFiles(
        params as z.infer<typeof grepFilesSchema>,
        context,
      );
    case "read_file":
      return executeReadFile(params as z.infer<typeof readFileSchema>, context);
    case "list_files":
      return executeListFiles(
        params as z.infer<typeof listFilesSchema>,
        context,
      );
    case "summarize_context":
      return executeSummarizeContext(
        params as z.infer<typeof summarizeContextSchema>,
        context,
      );
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
