import { eq } from "drizzle-orm";
import { db } from "@/db";
import type { BoardFile, Card } from "@/db/schema";
import { boardFiles } from "@/db/schema";

export interface ChatContext {
  sessionId: string;
  userId: string;
  cards: Card[];
  selectedCardId?: string;
  files?: BoardFile[];
}

/**
 * Build the system prompt for the AI chat assistant
 * Includes board context, selected card, and available tools
 */
export async function buildSystemPrompt(context: ChatContext): Promise<string> {
  const { sessionId, cards, selectedCardId, files } = context;

  // Get files if not provided
  let boardFilesList = files;
  if (!boardFilesList) {
    boardFilesList = await db.query.boardFiles.findMany({
      where: eq(boardFiles.sessionId, sessionId),
    });
  }

  const completedFiles = boardFilesList.filter(
    (f) => f.ingestionStatus === "completed",
  );

  // Build card context
  const cardContext = buildCardContext(cards, selectedCardId);

  // Build file context
  const fileContext = buildFileContext(completedFiles);

  // Build the system prompt
  const systemPrompt = `You are Pawboard's AI assistant, helping users brainstorm and organize ideas on a collaborative board.

## Your Capabilities
You have access to tools that let you:
- Create new idea cards on the board
- Update the content of the currently selected card (if one is selected)
- Search through uploaded files for information
- Read the full contents of uploaded files
- List all files in the board
- Summarize the board's content

## Guidelines
- Be concise but helpful
- When creating cards, keep content focused and clear
- When asked to create multiple related ideas, create separate cards for each
- Use the search_files tool when looking for specific information in documents
- Use the read_file tool only when you need the complete file content
- If no card is selected, you cannot use the update_card tool

## Current Board Context

### Cards on the Board
${cardContext}

### Uploaded Files
${fileContext}

${selectedCardId ? `### Currently Selected Card\nCard ID: ${selectedCardId}\n${getSelectedCardContent(cards, selectedCardId)}` : "### No card is currently selected"}

## Response Style
- Be helpful and collaborative
- Keep responses concise
- Use markdown formatting when appropriate
- When you take actions (like creating cards), confirm what you did
- If the user's request is unclear, ask for clarification`;

  return systemPrompt;
}

/**
 * Build context string for cards on the board
 */
function buildCardContext(cards: Card[], selectedCardId?: string): string {
  if (cards.length === 0) {
    return "The board is empty - no cards have been created yet.";
  }

  // Group cards by content presence
  const cardsWithContent = cards.filter(
    (c) => c.content && c.content.trim().length > 0,
  );
  const emptyCards = cards.filter(
    (c) => !c.content || c.content.trim().length === 0,
  );

  let context = `Total cards: ${cards.length}`;
  if (emptyCards.length > 0) {
    context += ` (${emptyCards.length} empty)`;
  }
  context += "\n\n";

  // Show card contents (truncate long content)
  if (cardsWithContent.length > 0) {
    context += "Card contents:\n";

    // Limit to 20 cards to avoid context overflow
    const displayCards = cardsWithContent.slice(0, 20);
    for (const card of displayCards) {
      const isSelected = card.id === selectedCardId;
      const prefix = isSelected ? "[SELECTED] " : "";
      const content =
        card.content.length > 200
          ? `${card.content.slice(0, 200)}...`
          : card.content;
      const votes = card.votes > 0 ? ` (${card.votes} votes)` : "";

      context += `- ${prefix}${content}${votes}\n`;
    }

    if (cardsWithContent.length > 20) {
      context += `\n... and ${cardsWithContent.length - 20} more cards`;
    }
  }

  return context;
}

/**
 * Build context string for uploaded files
 */
function buildFileContext(files: BoardFile[]): string {
  if (files.length === 0) {
    return "No files have been uploaded to this board.";
  }

  let context = `${files.length} file(s) available:\n`;

  for (const file of files) {
    const sizeKB = Math.round(file.sizeBytes / 1024);
    context += `- ${file.filename} (${sizeKB} KB, ${file.mimeType})\n`;
  }

  context +=
    "\nYou can use grep_files to search within these files or read_file to see full contents.";

  return context;
}

/**
 * Get content of the selected card
 */
function getSelectedCardContent(cards: Card[], selectedCardId: string): string {
  const card = cards.find((c) => c.id === selectedCardId);
  if (!card) {
    return "Selected card not found in context.";
  }

  if (!card.content || card.content.trim().length === 0) {
    return "The selected card is empty.";
  }

  return `Content:\n${card.content}`;
}

/**
 * Get a short summary of the board for display
 */
export function getBoardSummary(cards: Card[], files: BoardFile[]): string {
  const cardCount = cards.length;
  const cardsWithContent = cards.filter(
    (c) => c.content && c.content.trim().length > 0,
  ).length;
  const fileCount = files.length;

  const parts: string[] = [];

  if (cardCount > 0) {
    parts.push(
      `${cardCount} card${cardCount !== 1 ? "s" : ""}${cardsWithContent < cardCount ? ` (${cardsWithContent} with content)` : ""}`,
    );
  }

  if (fileCount > 0) {
    parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
  }

  if (parts.length === 0) {
    return "Empty board";
  }

  return parts.join(", ");
}
