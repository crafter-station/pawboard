"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import {
  type Card,
  type CommentWithCreator,
  cardEditHistory,
  cards,
  comments,
  type NewCard,
  type Session,
  type SessionRole,
  sessionParticipants,
  sessions,
  type ThreadWithDetails,
  threads,
  type User,
  users,
} from "@/db/schema";
import { generateSessionName, generateUsername } from "@/lib/names";
import {
  canAddCard,
  canChangeColor,
  canDeleteCard,
  canEditCard,
  canMoveCard,
  canReact,
  canVote,
} from "@/lib/permissions";
import {
  canAddComment,
  canCreateThread,
  canDeleteComment,
  canDeleteThread,
  canResolveThread,
  validateCommentContent,
} from "@/lib/thread-permissions";
import { extractTextFromTiptap, isContentEmpty } from "@/lib/tiptap-utils";

// Helper function to update activity timestamps
async function updateActivityTimestamps(sessionId: string, userId: string) {
  const now = new Date();
  try {
    // Run both updates in parallel (no dependency between them)
    await Promise.all([
      db
        .update(sessions)
        .set({ lastActivityAt: now })
        .where(eq(sessions.id, sessionId)),
      db
        .update(sessionParticipants)
        .set({ lastActiveAt: now })
        .where(
          and(
            eq(sessionParticipants.sessionId, sessionId),
            eq(sessionParticipants.userId, userId),
          ),
        ),
    ]);
  } catch (error) {
    console.error("Error updating activity timestamps:", error);
    // Don't throw - this shouldn't break the main operation
  }
}

// Session Actions

export async function getOrCreateSession(id: string) {
  try {
    let session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      const [newSession] = await db
        .insert(sessions)
        .values({ id, name: generateSessionName() })
        .returning();
      session = newSession;
    }

    return { session, error: null };
  } catch (error) {
    console.error("Database error in getOrCreateSession:", error);
    return { session: null, error: "Failed to connect to database" };
  }
}

const SESSION_NAME_MIN_LENGTH = 2;
const SESSION_NAME_MAX_LENGTH = 50;

function validateSessionName(name: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = name.trim();

  if (trimmed.length < SESSION_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Session name must be at least ${SESSION_NAME_MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > SESSION_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Session name must be at most ${SESSION_NAME_MAX_LENGTH} characters`,
    };
  }

  // Basic sanitization - no special control characters (ASCII 0-31 and 127)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: needed for sanitization
  const controlCharsRegex = /[\x00-\x1F\x7F]/;
  if (controlCharsRegex.test(trimmed)) {
    return { valid: false, error: "Session name contains invalid characters" };
  }

  return { valid: true };
}

export async function updateSessionName(
  sessionId: string,
  newName: string,
  userId: string,
): Promise<{ session: Session | null; error: string | null }> {
  try {
    // Check if user is session creator
    const userRole = await getUserRoleInSession(userId, sessionId);
    if (userRole !== "creator") {
      return {
        session: null,
        error: "Only the session creator can rename the session",
      };
    }

    const validation = validateSessionName(newName);
    if (!validation.valid) {
      return {
        session: null,
        error: validation.error ?? "Invalid session name",
      };
    }

    const [session] = await db
      .update(sessions)
      .set({ name: newName.trim(), lastActivityAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!session) {
      return { session: null, error: "Session not found" };
    }

    // Update user's lastActiveAt timestamp
    await db
      .update(sessionParticipants)
      .set({ lastActiveAt: new Date() })
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, userId),
        ),
      );

    return { session, error: null };
  } catch (error) {
    console.error("Database error in updateSessionName:", error);
    return { session: null, error: "Failed to update session name" };
  }
}

// Session Settings Actions

export interface SessionSettings {
  isLocked: boolean;
}

export async function updateSessionSettings(
  sessionId: string,
  settings: Partial<SessionSettings>,
  userId: string,
): Promise<{ session: Session | null; error: string | null }> {
  try {
    // Check if user is session creator
    const userRole = await getUserRoleInSession(userId, sessionId);
    if (userRole !== "creator") {
      return {
        session: null,
        error: "Only the session creator can change settings",
      };
    }

    const [session] = await db
      .update(sessions)
      .set({ ...settings, lastActivityAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!session) {
      return { session: null, error: "Session not found" };
    }

    // Update user's lastActiveAt timestamp
    await db
      .update(sessionParticipants)
      .set({ lastActiveAt: new Date() })
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, userId),
        ),
      );

    return { session, error: null };
  } catch (error) {
    console.error("Database error in updateSessionSettings:", error);
    return { session: null, error: "Failed to update session settings" };
  }
}

export async function deleteSession(
  sessionId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Check if user is session creator
    const userRole = await getUserRoleInSession(userId, sessionId);
    if (userRole !== "creator") {
      return {
        success: false,
        error: "Only the session creator can delete the session",
      };
    }

    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in deleteSession:", error);
    return { success: false, error: "Failed to delete session" };
  }
}

export async function getUserRoleInSession(
  userId: string,
  sessionId: string,
): Promise<SessionRole | null> {
  try {
    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, sessionId),
      ),
    });

    if (!participant) return null;

    return participant.role as SessionRole;
  } catch (error) {
    console.error("Database error in getUserRoleInSession:", error);
    return null;
  }
}

// User Actions

export async function getOrCreateUser(
  userId: string,
): Promise<{ user: User | null; error: string | null }> {
  try {
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          username: generateUsername(),
        })
        .returning();
      user = newUser;
    }

    return { user, error: null };
  } catch (error) {
    console.error("Database error in getOrCreateUser:", error);
    return { user: null, error: "Failed to get or create user" };
  }
}

export async function updateUsername(
  userId: string,
  newUsername: string,
): Promise<{ user: User | null; error: string | null }> {
  try {
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
      return { user: null, error: validation.error ?? "Invalid username" };
    }

    const [user] = await db
      .update(users)
      .set({ username: newUsername.trim() })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      return { user: null, error: "User not found" };
    }

    return { user, error: null };
  } catch (error) {
    console.error("Database error in updateUsername:", error);
    return { user: null, error: "Failed to update username" };
  }
}

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 30;

function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = username.trim();

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Name must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Name must be at most ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  // Basic sanitization - no special control characters (ASCII 0-31 and 127)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: needed for sanitization
  const controlCharsRegex = /[\x00-\x1F\x7F]/;
  if (controlCharsRegex.test(trimmed)) {
    return { valid: false, error: "Name contains invalid characters" };
  }

  return { valid: true };
}

// Session Participant Actions

export async function joinSession(
  userId: string,
  sessionId: string,
): Promise<{
  success: boolean;
  role: SessionRole | null;
  error: string | null;
}> {
  try {
    // Ensure user exists first
    const { user, error: userError } = await getOrCreateUser(userId);
    if (userError || !user) {
      return {
        success: false,
        role: null,
        error: userError ?? "Failed to create user",
      };
    }

    // Check if already a participant
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, sessionId),
      ),
    });

    if (existing) {
      // Update lastActiveAt since user is joining/re-entering session
      await db
        .update(sessionParticipants)
        .set({ lastActiveAt: new Date() })
        .where(
          and(
            eq(sessionParticipants.userId, userId),
            eq(sessionParticipants.sessionId, sessionId),
          ),
        );
      return { success: true, role: existing.role as SessionRole, error: null };
    }

    // Check if session has any participants (first user becomes creator)
    const existingParticipants = await db.query.sessionParticipants.findMany({
      where: eq(sessionParticipants.sessionId, sessionId),
    });

    const role: SessionRole =
      existingParticipants.length === 0 ? "creator" : "participant";

    await db.insert(sessionParticipants).values({
      userId,
      sessionId,
      role,
    });

    return { success: true, role, error: null };
  } catch (error) {
    console.error("Database error in joinSession:", error);
    return { success: false, role: null, error: "Failed to join session" };
  }
}

export async function getUserSessions(userId: string): Promise<{
  sessions: Array<{
    id: string;
    name: string;
    role: SessionRole;
    creatorName: string;
    lastActivityAt: Date;
    lastActiveAt: Date;
    cardCount: number;
  }>;
  error: string | null;
}> {
  try {
    // Get all sessions where user is a participant with session data
    const participations = await db.query.sessionParticipants.findMany({
      where: eq(sessionParticipants.userId, userId),
      with: {
        session: {
          with: {
            participants: {
              where: eq(sessionParticipants.role, "creator"),
              with: {
                user: true,
              },
            },
            cards: {
              columns: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Transform the data - no additional queries needed
    const sessionsData = participations.map((participation) => {
      const creator = participation.session.participants[0];
      return {
        id: participation.session.id,
        name: participation.session.name,
        role: participation.role as SessionRole,
        creatorName: creator?.user.username ?? "Unknown",
        lastActivityAt: participation.session.lastActivityAt,
        lastActiveAt: participation.lastActiveAt,
        cardCount: participation.session.cards.length,
      };
    });

    // Sort by lastActiveAt (most recent first)
    sessionsData.sort(
      (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
    );

    return { sessions: sessionsData, error: null };
  } catch (error) {
    console.error("Database error in getUserSessions:", error);
    return { sessions: [], error: "Failed to fetch sessions" };
  }
}

export async function getSessionParticipants(
  sessionId: string,
): Promise<{ visitorId: string; username: string }[]> {
  try {
    // Get participants and card creators in parallel
    const [participants, cardCreators] = await Promise.all([
      // Get participants who explicitly joined the session
      db.query.sessionParticipants.findMany({
        where: eq(sessionParticipants.sessionId, sessionId),
        with: {
          user: true,
        },
      }),
      // Get distinct card creators for this session
      db
        .selectDistinct({
          createdById: cards.createdById,
        })
        .from(cards)
        .where(eq(cards.sessionId, sessionId)),
    ]);

    // Build map from participants
    const userMap = new Map<string, string>();
    for (const p of participants) {
      userMap.set(p.userId, p.user.username);
    }

    // Get any card creators not already in the map
    const missingCreatorIds = cardCreators
      .map((c) => c.createdById)
      .filter((id) => !userMap.has(id));

    if (missingCreatorIds.length > 0) {
      const missingUsers = await db.query.users.findMany({
        where: inArray(users.id, missingCreatorIds),
      });
      for (const user of missingUsers) {
        userMap.set(user.id, user.username);
      }
    }

    return Array.from(userMap.entries()).map(([visitorId, username]) => ({
      visitorId,
      username,
    }));
  } catch (error) {
    console.error("Database error in getSessionParticipants:", error);
    return [];
  }
}

// Card Actions

export async function getSessionCards(sessionId: string) {
  try {
    return await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
    });
  } catch (error) {
    console.error("Database error in getSessionCards:", error);
    return [];
  }
}

export type CardEditHistoryWithUser = {
  id: string;
  cardId: string;
  userId: string;
  editedAt: Date;
  user: {
    id: string;
    username: string;
  };
};

export async function getCardEditHistory(
  cardId: string,
): Promise<{ history: CardEditHistoryWithUser[]; error: string | null }> {
  try {
    const history = await db.query.cardEditHistory.findMany({
      where: eq(cardEditHistory.cardId, cardId),
      with: {
        user: true,
      },
      orderBy: (history, { desc }) => [desc(history.editedAt)],
    });

    return { history, error: null };
  } catch (error) {
    console.error("Database error in getCardEditHistory:", error);
    return { history: [], error: "Failed to get card edit history" };
  }
}

export async function getCardEditors(cardId: string): Promise<{
  editors: Array<{ userId: string; username: string }>;
  error: string | null;
}> {
  try {
    // Get distinct editors ordered by most recent edit
    const history = await db.query.cardEditHistory.findMany({
      where: eq(cardEditHistory.cardId, cardId),
      with: {
        user: true,
      },
      orderBy: (history, { desc }) => [desc(history.editedAt)],
    });

    // Get unique editors while preserving order (most recent first)
    const seen = new Set<string>();
    const editors: Array<{ userId: string; username: string }> = [];

    for (const entry of history) {
      if (!seen.has(entry.userId)) {
        seen.add(entry.userId);
        editors.push({
          userId: entry.userId,
          username: entry.user.username,
        });
      }
    }

    return { editors, error: null };
  } catch (error) {
    console.error("Database error in getCardEditors:", error);
    return { editors: [], error: "Failed to get card editors" };
  }
}

export async function createCard(
  data: NewCard,
  userId: string,
): Promise<{ card: Card | null; error: string | null }> {
  try {
    // Get session to check if locked
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, data.sessionId),
    });

    if (!session) {
      return { card: null, error: "Session not found" };
    }

    // Get user's role
    const userRole = await getUserRoleInSession(userId, data.sessionId);

    if (!canAddCard(session, userRole ?? "participant")) {
      return { card: null, error: "Session is locked. Cannot add new cards." };
    }

    const [card] = await db.insert(cards).values(data).returning();

    // Update activity timestamps
    await updateActivityTimestamps(data.sessionId, userId);

    return { card, error: null };
  } catch (error) {
    console.error("Database error in createCard:", error);
    return { card: null, error: "Failed to create card" };
  }
}

export async function updateCard(
  id: string,
  data: Partial<Pick<Card, "content" | "color" | "x" | "y">>,
  userId: string,
): Promise<{ card: Card | null; error: string | null }> {
  try {
    // Get the card with its session in one query (avoid waterfall)
    const existingCard = await db.query.cards.findFirst({
      where: eq(cards.id, id),
      with: {
        session: true,
      },
    });

    if (!existingCard) {
      return { card: null, error: "Card not found" };
    }

    const session = existingCard.session;

    if (!session) {
      return { card: null, error: "Session not found" };
    }

    // Get user's role
    const userRole = await getUserRoleInSession(userId, existingCard.sessionId);

    // Check permissions based on what's being updated
    if (data.content !== undefined) {
      if (
        !canEditCard(session, existingCard, userId, userRole ?? "participant")
      ) {
        return {
          card: null,
          error: "You don't have permission to edit this card",
        };
      }
    }

    if (data.x !== undefined || data.y !== undefined) {
      if (
        !canMoveCard(session, existingCard, userId, userRole ?? "participant")
      ) {
        return {
          card: null,
          error: "You don't have permission to move this card",
        };
      }
    }

    if (data.color !== undefined) {
      if (
        !canChangeColor(
          session,
          existingCard,
          userId,
          userRole ?? "participant",
        )
      ) {
        return {
          card: null,
          error: "You don't have permission to change this card's color",
        };
      }
    }

    const [card] = await db
      .update(cards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cards.id, id))
      .returning();

    // Update activity timestamps
    await updateActivityTimestamps(existingCard.sessionId, userId);

    // If content was updated AND actually changed, generate embedding in background
    // and record edit history
    const contentChanged =
      data.content !== undefined &&
      JSON.stringify(data.content) !== JSON.stringify(existingCard.content);

    if (contentChanged) {
      const cardId = id;
      // Extract plain text for embedding generation
      const content = data.content ? extractTextFromTiptap(data.content) : "";

      // Get the host from request headers BEFORE the after() callback
      // This is needed because env vars may not be available in after() context on Vercel
      const headersList = await headers();
      const host = headersList.get("host");
      const protocol = headersList.get("x-forwarded-proto") || "https";
      const baseUrl = host
        ? `${protocol}://${host}`
        : process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : null) ||
          "http://localhost:3000";
      const secret = process.env.INTERNAL_API_SECRET;

      // Record/update edit history - one entry per user per card
      const existingEdit = await db.query.cardEditHistory.findFirst({
        where: and(
          eq(cardEditHistory.cardId, cardId),
          eq(cardEditHistory.userId, userId),
        ),
      });

      if (existingEdit) {
        // Update existing entry's timestamp
        await db
          .update(cardEditHistory)
          .set({ editedAt: new Date() })
          .where(eq(cardEditHistory.id, existingEdit.id));
      } else {
        // Create new entry
        await db.insert(cardEditHistory).values({
          id: crypto.randomUUID(),
          cardId,
          userId,
        });
      }

      after(async () => {
        try {
          if (!secret) {
            console.error(
              "INTERNAL_API_SECRET not configured for embedding generation",
            );
            return;
          }

          await fetch(`${baseUrl}/api/embeddings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ cardId, content }),
          });
        } catch (error) {
          console.error("Failed to trigger embedding generation:", error);
        }
      });
    }

    return { card, error: null };
  } catch (error) {
    console.error("Database error in updateCard:", error);
    return { card: null, error: "Failed to update card" };
  }
}

export async function resizeCard(
  id: string,
  width: number,
  height: number,
  sessionId: string,
  userId: string,
): Promise<{ card: Card | null; error: string | null }> {
  try {
    // Get the card with its session in one query (avoid waterfall)
    const existingCard = await db.query.cards.findFirst({
      where: eq(cards.id, id),
      with: {
        session: true,
      },
    });

    if (!existingCard) {
      return { card: null, error: "Card not found" };
    }

    const session = existingCard.session;

    if (!session) {
      return { card: null, error: "Session not found" };
    }

    // Get user's role
    const userRole = await getUserRoleInSession(userId, existingCard.sessionId);

    // Use move permission for resize
    if (
      !canMoveCard(session, existingCard, userId, userRole ?? "participant")
    ) {
      return {
        card: null,
        error: "You don't have permission to resize this card",
      };
    }

    // Clamp to constraints
    const clampedWidth = Math.max(150, Math.min(600, Math.round(width)));
    const clampedHeight = Math.max(100, Math.min(400, Math.round(height)));

    const [card] = await db
      .update(cards)
      .set({
        width: clampedWidth,
        height: clampedHeight,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, id))
      .returning();

    after(async () => {
      await updateActivityTimestamps(sessionId, userId);
    });

    return { card, error: null };
  } catch (error) {
    console.error("Database error in resizeCard:", error);
    return { card: null, error: "Failed to resize card" };
  }
}

export async function voteCard(
  id: string,
  visitorId: string,
): Promise<{
  card: Card | null;
  action: "added" | "removed" | "denied";
  error: string | null;
}> {
  try {
    // Get card with session in one query (avoid waterfall)
    const existing = await db.query.cards.findFirst({
      where: eq(cards.id, id),
      with: {
        session: true,
      },
    });

    if (!existing) {
      return { card: null, action: "denied", error: "Card not found" };
    }

    const session = existing.session;

    if (!session) {
      return { card: null, action: "denied", error: "Session not found" };
    }

    // Get user's role
    const userRole = await getUserRoleInSession(visitorId, existing.sessionId);

    if (!canVote(session, existing, visitorId, userRole ?? "participant")) {
      if (existing.createdById === visitorId) {
        return { card: existing, action: "denied", error: null }; // Can't vote on own card
      }
      return {
        card: existing,
        action: "denied",
        error: "Session is locked. Cannot vote.",
      };
    }

    const votedBy = existing.votedBy || [];
    const hasVoted = votedBy.includes(visitorId);

    let newVotedBy: string[];
    let newVotes: number;

    if (hasVoted) {
      newVotedBy = votedBy.filter((v) => v !== visitorId);
      newVotes = existing.votes - 1;
    } else {
      newVotedBy = [...votedBy, visitorId];
      newVotes = existing.votes + 1;
    }

    const [card] = await db
      .update(cards)
      .set({ votes: newVotes, votedBy: newVotedBy, updatedAt: new Date() })
      .where(eq(cards.id, id))
      .returning();

    // Update activity timestamps
    await updateActivityTimestamps(existing.sessionId, visitorId);

    return { card, action: hasVoted ? "removed" : "added", error: null };
  } catch (error) {
    console.error("Database error in voteCard:", error);
    return { card: null, action: "denied", error: "Failed to vote on card" };
  }
}

export async function toggleReaction(
  cardId: string,
  emoji: string,
  userId: string,
): Promise<{
  card: Card | null;
  action: "added" | "removed" | "denied";
  error: string | null;
}> {
  try {
    // Fetch card with session in single query to avoid waterfall
    const existing = await db.query.cards.findFirst({
      where: eq(cards.id, cardId),
      with: { session: true },
    });

    if (!existing) {
      return { card: null, action: "denied", error: "Card not found" };
    }

    const { session } = existing;

    if (!session) {
      return { card: null, action: "denied", error: "Session not found" };
    }

    // Get user's role
    const userRole = await getUserRoleInSession(userId, existing.sessionId);

    if (!canReact(session, existing, userId, userRole ?? "participant")) {
      if (existing.createdById === userId) {
        return { card: existing, action: "denied", error: null };
      }
      return {
        card: existing,
        action: "denied",
        error: "Session is locked. Cannot react.",
      };
    }

    const reactions = existing.reactions || {};
    const emojiReactions = reactions[emoji] || [];
    const hasReacted = emojiReactions.includes(userId);

    let newEmojiReactions: string[];
    if (hasReacted) {
      newEmojiReactions = emojiReactions.filter((id) => id !== userId);
    } else {
      newEmojiReactions = [...emojiReactions, userId];
    }

    const newReactions = { ...reactions };
    if (newEmojiReactions.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = newEmojiReactions;
    }

    const [card] = await db
      .update(cards)
      .set({ reactions: newReactions, updatedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();

    // Update activity timestamps
    await updateActivityTimestamps(existing.sessionId, userId);

    return { card, action: hasReacted ? "removed" : "added", error: null };
  } catch (error) {
    console.error("Database error in toggleReaction:", error);
    return { card: null, action: "denied", error: "Failed to toggle reaction" };
  }
}

export async function deleteCard(
  id: string,
  visitorId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Fetch card with session in single query to avoid waterfall
    const existing = await db.query.cards.findFirst({
      where: eq(cards.id, id),
      with: { session: true },
    });

    if (!existing) {
      return { success: false, error: "Card not found" };
    }

    const { session } = existing;

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Get user's role from database - don't trust client-supplied role
    const userRole = await getUserRoleInSession(visitorId, existing.sessionId);

    if (
      !canDeleteCard(session, existing, visitorId, userRole ?? "participant")
    ) {
      return {
        success: false,
        error: "You don't have permission to delete this card",
      };
    }

    await db.delete(cards).where(eq(cards.id, id));

    // Update activity timestamps
    await updateActivityTimestamps(existing.sessionId, visitorId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in deleteCard:", error);
    return { success: false, error: "Failed to delete card" };
  }
}

export async function deleteEmptyCards(
  sessionId: string,
  userId: string,
): Promise<{
  deletedIds: string[];
  deletedCount: number;
  error: string | null;
}> {
  try {
    // Check if user is session creator
    const userRole = await getUserRoleInSession(userId, sessionId);
    if (userRole !== "creator") {
      return {
        deletedIds: [],
        deletedCount: 0,
        error: "Only the session creator can clean up empty cards",
      };
    }

    // Get session to verify it exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return {
        deletedIds: [],
        deletedCount: 0,
        error: "Session not found",
      };
    }

    // Find all empty cards (content is empty or whitespace only)
    const allCards = await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
    });

    // Filter for empty cards that the user has permission to delete
    // Session creators (which we already verified) can always delete any card
    const emptyCardsToDelete = allCards.filter(
      (card: Card) =>
        isContentEmpty(card.content) &&
        canDeleteCard(session, card, userId, userRole),
    );

    const emptyCardIds = emptyCardsToDelete.map((card: Card) => card.id);

    if (emptyCardIds.length === 0) {
      return {
        deletedIds: [],
        deletedCount: 0,
        error: null,
      };
    }

    // Delete all empty cards
    await db.delete(cards).where(inArray(cards.id, emptyCardIds));

    // Update activity timestamps
    await updateActivityTimestamps(sessionId, userId);

    return {
      deletedIds: emptyCardIds,
      deletedCount: emptyCardIds.length,
      error: null,
    };
  } catch (error) {
    console.error("Database error in deleteEmptyCards:", error);
    return {
      deletedIds: [],
      deletedCount: 0,
      error: "Failed to delete empty cards",
    };
  }
}

// Clustering Actions

import { type CardPosition, clusterAndPosition } from "@/lib/clustering";

export async function clusterCards(
  sessionId: string,
  userId: string,
): Promise<{
  positions: CardPosition[];
  clusterCount: number;
  cardsProcessed: number;
  error: string | null;
}> {
  try {
    // Check if user is session creator
    const userRole = await getUserRoleInSession(userId, sessionId);
    if (userRole !== "creator") {
      return {
        positions: [],
        clusterCount: 0,
        cardsProcessed: 0,
        error: "Only the session creator can cluster cards",
      };
    }

    // Check if session exists and is not locked
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return {
        positions: [],
        clusterCount: 0,
        cardsProcessed: 0,
        error: "Session not found",
      };
    }

    if (session.isLocked) {
      return {
        positions: [],
        clusterCount: 0,
        cardsProcessed: 0,
        error: "Cannot cluster cards in a locked session",
      };
    }

    // Get all cards with embeddings
    const allCards = await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
    });

    // Filter to cards with content and embeddings
    const cardsWithEmbeddings = allCards.filter(
      (card) =>
        !isContentEmpty(card.content) &&
        card.embedding &&
        Array.isArray(card.embedding) &&
        card.embedding.length > 0,
    );

    if (cardsWithEmbeddings.length === 0) {
      return {
        positions: [],
        clusterCount: 0,
        cardsProcessed: 0,
        error:
          "No cards with content and embeddings to cluster. Try editing some cards first.",
      };
    }

    if (cardsWithEmbeddings.length === 1) {
      // Single card - just return its current position
      const card = cardsWithEmbeddings[0];
      return {
        positions: [{ id: card.id, x: card.x, y: card.y }],
        clusterCount: 1,
        cardsProcessed: 1,
        error: null,
      };
    }

    // Build embeddings map for clustering
    const cardEmbeddings = new Map<string, number[]>();
    for (const card of cardsWithEmbeddings) {
      if (card.embedding) {
        cardEmbeddings.set(card.id, card.embedding as number[]);
      }
    }

    // Run clustering algorithm
    const { positions, clusterCount } = clusterAndPosition(cardEmbeddings);

    // Batch update card positions in database
    for (const position of positions) {
      await db
        .update(cards)
        .set({ x: position.x, y: position.y, updatedAt: new Date() })
        .where(eq(cards.id, position.id));
    }

    return {
      positions,
      clusterCount,
      cardsProcessed: cardsWithEmbeddings.length,
      error: null,
    };
  } catch (error) {
    console.error("Database error in clusterCards:", error);
    return {
      positions: [],
      clusterCount: 0,
      cardsProcessed: 0,
      error: "Failed to cluster cards",
    };
  }
}

// Thread Actions

export async function getSessionThreads(
  sessionId: string,
): Promise<{ threads: ThreadWithDetails[]; error: string | null }> {
  try {
    const result = await db.query.threads.findMany({
      where: eq(threads.sessionId, sessionId),
      with: {
        creator: {
          columns: { id: true, username: true },
        },
        comments: {
          with: {
            creator: {
              columns: { id: true, username: true },
            },
          },
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
      },
      orderBy: (threads, { desc }) => [desc(threads.createdAt)],
    });

    return { threads: result as ThreadWithDetails[], error: null };
  } catch (error) {
    console.error("Database error in getSessionThreads:", error);
    return { threads: [], error: "Failed to fetch threads" };
  }
}

export async function createThread(
  data: {
    sessionId: string;
    x?: number;
    y?: number;
    cardId?: string;
    initialComment: string;
  },
  userId: string,
): Promise<{ thread: ThreadWithDetails | null; error: string | null }> {
  try {
    // Validate comment content
    const validation = validateCommentContent(data.initialComment);
    if (!validation.valid) {
      return { thread: null, error: validation.error ?? "Invalid comment" };
    }

    // Get session
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, data.sessionId),
    });

    if (!session) {
      return { thread: null, error: "Session not found" };
    }

    // Get user role
    const userRole = await getUserRoleInSession(userId, data.sessionId);

    if (!canCreateThread(session, userRole)) {
      return {
        thread: null,
        error: "Session is locked. Cannot create threads.",
      };
    }

    // Validate positioning - must have either x,y or cardId
    if ((data.x === undefined || data.y === undefined) && !data.cardId) {
      return {
        thread: null,
        error:
          "Thread must have either position (x, y) or be attached to a card",
      };
    }

    const threadId = crypto.randomUUID();
    const commentId = crypto.randomUUID();

    // Create thread and initial comment
    await db.insert(threads).values({
      id: threadId,
      sessionId: data.sessionId,
      x: data.x,
      y: data.y,
      cardId: data.cardId,
      createdById: userId,
    });

    await db.insert(comments).values({
      id: commentId,
      threadId: threadId,
      content: data.initialComment.trim(),
      createdById: userId,
    });

    // Update activity timestamps
    await updateActivityTimestamps(data.sessionId, userId);

    // Fetch the complete thread with relations
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: {
        creator: {
          columns: { id: true, username: true },
        },
        comments: {
          with: {
            creator: {
              columns: { id: true, username: true },
            },
          },
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
      },
    });

    return { thread: thread as ThreadWithDetails, error: null };
  } catch (error) {
    console.error("Database error in createThread:", error);
    return { thread: null, error: "Failed to create thread" };
  }
}

export async function moveThread(
  threadId: string,
  x: number,
  y: number,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    // Only canvas threads can be moved (not card-attached)
    if (thread.cardId) {
      return {
        success: false,
        error: "Cannot move thread attached to a card",
      };
    }

    await db
      .update(threads)
      .set({ x, y, updatedAt: new Date() })
      .where(eq(threads.id, threadId));

    // Update activity timestamps
    await updateActivityTimestamps(thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in moveThread:", error);
    return { success: false, error: "Failed to move thread" };
  }
}

export async function attachThreadToCard(
  threadId: string,
  cardId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    // Verify card exists and is in the same session
    const card = await db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.sessionId, thread.sessionId)),
    });

    if (!card) {
      return { success: false, error: "Card not found in this session" };
    }

    // Check session lock
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, thread.sessionId),
    });

    if (session?.isLocked) {
      return { success: false, error: "Session is locked" };
    }

    // Update thread: set cardId, clear x/y
    await db
      .update(threads)
      .set({
        cardId: cardId,
        x: null,
        y: null,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, threadId));

    await updateActivityTimestamps(thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in attachThreadToCard:", error);
    return { success: false, error: "Failed to attach thread to card" };
  }
}

export async function detachThreadFromCard(
  threadId: string,
  x: number,
  y: number,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    // Must be attached to a card to detach
    if (!thread.cardId) {
      return { success: false, error: "Thread is not attached to a card" };
    }

    // Check session lock
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, thread.sessionId),
    });

    if (session?.isLocked) {
      return { success: false, error: "Session is locked" };
    }

    // Update thread: clear cardId, set x/y
    await db
      .update(threads)
      .set({
        cardId: null,
        x: x,
        y: y,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, threadId));

    await updateActivityTimestamps(thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in detachThreadFromCard:", error);
    return { success: false, error: "Failed to detach thread from card" };
  }
}

export async function resolveThread(
  threadId: string,
  isResolved: boolean,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    // Get user role
    const userRole = await getUserRoleInSession(userId, thread.sessionId);

    if (!canResolveThread(thread, userId, userRole)) {
      return {
        success: false,
        error: "You don't have permission to resolve this thread",
      };
    }

    await db
      .update(threads)
      .set({ isResolved, updatedAt: new Date() })
      .where(eq(threads.id, threadId));

    // Update activity timestamps
    await updateActivityTimestamps(thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in resolveThread:", error);
    return { success: false, error: "Failed to resolve thread" };
  }
}

export async function deleteThread(
  threadId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    // Get user role
    const userRole = await getUserRoleInSession(userId, thread.sessionId);

    if (!canDeleteThread(thread, userId, userRole)) {
      return {
        success: false,
        error: "You don't have permission to delete this thread",
      };
    }

    await db.delete(threads).where(eq(threads.id, threadId));

    // Update activity timestamps
    await updateActivityTimestamps(thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in deleteThread:", error);
    return { success: false, error: "Failed to delete thread" };
  }
}

// Comment Actions

export async function addComment(
  threadId: string,
  content: string,
  userId: string,
): Promise<{ comment: CommentWithCreator | null; error: string | null }> {
  try {
    // Validate content
    const validation = validateCommentContent(content);
    if (!validation.valid) {
      return { comment: null, error: validation.error ?? "Invalid comment" };
    }

    // Get thread with session
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: { session: true },
    });

    if (!thread) {
      return { comment: null, error: "Thread not found" };
    }

    // Get user role
    const userRole = await getUserRoleInSession(userId, thread.sessionId);

    if (!canAddComment(thread.session, userRole)) {
      return {
        comment: null,
        error: "Session is locked. Cannot add comments.",
      };
    }

    const commentId = crypto.randomUUID();

    await db.insert(comments).values({
      id: commentId,
      threadId,
      content: content.trim(),
      createdById: userId,
    });

    // Update thread's updatedAt
    await db
      .update(threads)
      .set({ updatedAt: new Date() })
      .where(eq(threads.id, threadId));

    // Update activity timestamps
    await updateActivityTimestamps(thread.sessionId, userId);

    // Fetch the comment with creator
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: {
        creator: {
          columns: { id: true, username: true },
        },
      },
    });

    return { comment: comment as CommentWithCreator, error: null };
  } catch (error) {
    console.error("Database error in addComment:", error);
    return { comment: null, error: "Failed to add comment" };
  }
}

export async function updateComment(
  commentId: string,
  content: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Validate content
    const validation = validateCommentContent(content);
    if (!validation.valid) {
      return { success: false, error: validation.error ?? "Invalid comment" };
    }

    // Get comment
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: {
        thread: true,
      },
    });

    if (!comment) {
      return { success: false, error: "Comment not found" };
    }

    // Only comment author can edit
    if (comment.createdById !== userId) {
      return {
        success: false,
        error: "You can only edit your own comments",
      };
    }

    await db
      .update(comments)
      .set({ content: content.trim(), updatedAt: new Date() })
      .where(eq(comments.id, commentId));

    // Update thread's updatedAt
    await db
      .update(threads)
      .set({ updatedAt: new Date() })
      .where(eq(threads.id, comment.threadId));

    // Update activity timestamps
    await updateActivityTimestamps(comment.thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in updateComment:", error);
    return { success: false, error: "Failed to update comment" };
  }
}

export async function deleteComment(
  commentId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Get comment with thread
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: {
        thread: true,
      },
    });

    if (!comment) {
      return { success: false, error: "Comment not found" };
    }

    // Get user role
    const userRole = await getUserRoleInSession(
      userId,
      comment.thread.sessionId,
    );

    if (!canDeleteComment(comment, userId, userRole)) {
      return {
        success: false,
        error: "You don't have permission to delete this comment",
      };
    }

    // Check if this is the last comment in the thread
    const commentCount = await db
      .select({ count: comments.id })
      .from(comments)
      .where(eq(comments.threadId, comment.threadId));

    // If this is the only comment, delete the entire thread instead
    if (commentCount.length === 1) {
      await db.delete(threads).where(eq(threads.id, comment.threadId));
    } else {
      await db.delete(comments).where(eq(comments.id, commentId));

      // Update thread's updatedAt
      await db
        .update(threads)
        .set({ updatedAt: new Date() })
        .where(eq(threads.id, comment.threadId));
    }

    // Update activity timestamps
    await updateActivityTimestamps(comment.thread.sessionId, userId);

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in deleteComment:", error);
    return { success: false, error: "Failed to delete comment" };
  }
}
