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

## Your Tools

### Card Tools
- **create_card**: Create a new idea card on the board. Use when user wants to add ideas.
- **update_card**: Update the selected card's content. Only works if a card is selected.
- **get_all_cards**: Get all cards on the board. Use this to see everything, summarize the board, or get an overview of all ideas.
- **search_cards**: Search cards by semantic similarity. Use to find cards about a specific topic.
- **get_cards_by_user**: Get cards created by a specific user.

### File Tools
- **grep_files**: Search through uploaded files using semantic search.
- **read_file**: Read the complete contents of a specific file.
- **list_files**: List all uploaded files on the board.

## When to Use Each Tool

**For summarizing or getting an overview:**
→ Use \`get_all_cards\` to fetch all cards, then create a summary yourself.

**For finding specific topics:**
→ Use \`search_cards\` with a descriptive query.

**For user-specific queries:**
→ Use \`get_cards_by_user\` with the username.

**For creating content:**
→ Use \`create_card\` for each distinct idea. Create separate cards for separate ideas.

## Guidelines
- Be concise but helpful
- When creating cards, keep content focused and clear
- When asked to create multiple ideas, create separate cards for each
- If no card is selected, you cannot use update_card
- When summarizing the board, first fetch all cards with get_all_cards

## Current Board Context

### Cards Overview
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
