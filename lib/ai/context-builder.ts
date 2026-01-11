import { eq } from "drizzle-orm";
import { db } from "@/db";
import type { BoardFile, Card } from "@/db/schema";
import { boardFiles, sessionParticipants, users } from "@/db/schema";

export interface ChatContext {
  sessionId: string;
  userId: string;
  username?: string;
  cards: Card[];
  selectedCardId?: string;
  files?: BoardFile[];
}

/**
 * Build the system prompt for the AI chat assistant
 * Includes board context, selected card, and available tools
 */
export async function buildSystemPrompt(context: ChatContext): Promise<string> {
  const { sessionId, userId, username, cards, selectedCardId, files } = context;

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

  // Get participants for this session
  const participants = await getSessionParticipants(sessionId);

  // Get current user's name if not provided
  const currentUsername = username || (await getCurrentUsername(userId));

  // Build card context
  const cardContext = buildCardContext(cards, selectedCardId);

  // Build file context
  const fileContext = buildFileContext(completedFiles);

  // Build participants context
  const participantsContext = buildParticipantsContext(participants, userId);

  // Build selected card context
  const selectedCardContext = buildSelectedCardContext(
    cards,
    selectedCardId,
    participants,
  );

  // Build the system prompt
  const systemPrompt = `You are Pawboard's AI assistant, helping users brainstorm and organize ideas on a collaborative board.

## Current User
You are chatting with: **${currentUsername || "Unknown User"}**

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
- Address the user by their name when appropriate

## Board Context

### Participants
${participantsContext}

### Cards Overview
${cardContext}

### Uploaded Files
${fileContext}

${selectedCardContext}

## Response Style
- Be helpful and collaborative
- Keep responses concise
- Use markdown formatting when appropriate
- When you take actions (like creating cards), confirm what you did
- If the user's request is unclear, ask for clarification`;

  return systemPrompt;
}

interface Participant {
  odilUserId: string;
  username: string;
}

/**
 * Get all participants in a session
 */
async function getSessionParticipants(
  sessionId: string,
): Promise<Participant[]> {
  const participants = await db
    .select({
      odilUserId: sessionParticipants.userId,
      username: users.username,
    })
    .from(sessionParticipants)
    .innerJoin(users, eq(sessionParticipants.userId, users.id))
    .where(eq(sessionParticipants.sessionId, sessionId));

  return participants;
}

/**
 * Get the current user's username
 */
async function getCurrentUsername(userId: string): Promise<string | undefined> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return user?.username;
}

/**
 * Build context string for participants
 */
function buildParticipantsContext(
  participants: Participant[],
  currentUserId: string,
): string {
  if (participants.length === 0) {
    return "No participants found.";
  }

  const lines = participants.map((p) => {
    const isCurrentUser = p.odilUserId === currentUserId;
    return `- ${p.username}${isCurrentUser ? " (you)" : ""}`;
  });

  return `${participants.length} participant(s) on this board:\n${lines.join("\n")}`;
}

/**
 * Build detailed context for the selected card
 */
function buildSelectedCardContext(
  cards: Card[],
  selectedCardId: string | undefined,
  participants: Participant[],
): string {
  if (!selectedCardId) {
    return "### Selected Card\nNo card is currently selected. You cannot use the update_card tool.";
  }

  const card = cards.find((c) => c.id === selectedCardId);
  if (!card) {
    return "### Selected Card\nSelected card not found.";
  }

  const creator = participants.find((p) => p.odilUserId === card.createdById);
  const creatorName = creator?.username || "Unknown";

  let context = `### Selected Card\n`;
  context += `- **ID**: ${card.id}\n`;
  context += `- **Created by**: ${creatorName}\n`;
  context += `- **Color**: ${card.color}\n`;
  context += `- **Votes**: ${card.votes}\n`;
  context += `- **Content**:\n${card.content || "(empty)"}\n`;
  context += `\nYou can use the update_card tool to modify this card's content.`;

  return context;
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
