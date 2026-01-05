"use server";

import { db } from "@/db";
import { sessions, cards, sessionParticipants, users } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateUsername, generateSessionName } from "@/lib/names";
import {
  canAddCard,
  canDeleteCard,
  canEditCard,
  canMoveCard,
  canVote,
  canChangeColor,
} from "@/lib/permissions";
import type {
  Card,
  NewCard,
  User,
  Session,
  SessionRole,
  MovePermission,
  DeletePermission,
} from "@/db/schema";

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
  const controlCharsRegex = new RegExp("[\\x00-\\x1F\\x7F]");
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
      .set({ name: newName.trim() })
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!session) {
      return { session: null, error: "Session not found" };
    }

    return { session, error: null };
  } catch (error) {
    console.error("Database error in updateSessionName:", error);
    return { session: null, error: "Failed to update session name" };
  }
}

// Session Settings Actions

export interface SessionSettings {
  isLocked: boolean;
  movePermission: MovePermission;
  deletePermission: DeletePermission;
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
      .set(settings)
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!session) {
      return { session: null, error: "Session not found" };
    }

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
  const controlCharsRegex = new RegExp("[\\x00-\\x1F\\x7F]");
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

export async function getSessionParticipants(
  sessionId: string,
): Promise<{ visitorId: string; username: string }[]> {
  try {
    // Get participants who explicitly joined the session
    const participants = await db.query.sessionParticipants.findMany({
      where: eq(sessionParticipants.sessionId, sessionId),
      with: {
        user: true,
      },
    });

    // Get all card creators for this session (they may not be in session_participants)
    const sessionCards = await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
      with: {
        creator: true,
      },
    });

    // Combine both into a map to deduplicate
    const userMap = new Map<string, string>();

    // Add participants
    for (const p of participants) {
      userMap.set(p.userId, p.user.username);
    }

    // Add card creators
    for (const card of sessionCards) {
      if (card.creator && !userMap.has(card.createdById)) {
        userMap.set(card.createdById, card.creator.username);
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

export async function createCard(
  data: NewCard,
  _userId: string,
): Promise<{ card: Card | null; error: string | null }> {
  try {
    // Get session to check if locked
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, data.sessionId),
    });

    if (!session) {
      return { card: null, error: "Session not found" };
    }

    if (!canAddCard(session)) {
      return { card: null, error: "Session is locked. Cannot add new cards." };
    }

    const [card] = await db.insert(cards).values(data).returning();
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
    // Get the card and its session
    const existingCard = await db.query.cards.findFirst({
      where: eq(cards.id, id),
    });

    if (!existingCard) {
      return { card: null, error: "Card not found" };
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, existingCard.sessionId),
    });

    if (!session) {
      return { card: null, error: "Session not found" };
    }

    // Check permissions based on what's being updated
    if (data.content !== undefined) {
      if (!canEditCard(session, existingCard, userId)) {
        return {
          card: null,
          error: "You don't have permission to edit this card",
        };
      }
    }

    if (data.x !== undefined || data.y !== undefined) {
      if (!canMoveCard(session, existingCard, userId)) {
        return {
          card: null,
          error: "You don't have permission to move this card",
        };
      }
    }

    if (data.color !== undefined) {
      if (!canChangeColor(session, existingCard, userId)) {
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

    return { card, error: null };
  } catch (error) {
    console.error("Database error in updateCard:", error);
    return { card: null, error: "Failed to update card" };
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
    const existing = await db.query.cards.findFirst({
      where: eq(cards.id, id),
    });

    if (!existing) {
      return { card: null, action: "denied", error: "Card not found" };
    }

    // Get session to check if locked
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, existing.sessionId),
    });

    if (!session) {
      return { card: null, action: "denied", error: "Session not found" };
    }

    if (!canVote(session, existing, visitorId)) {
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

    return { card, action: hasVoted ? "removed" : "added", error: null };
  } catch (error) {
    console.error("Database error in voteCard:", error);
    return { card: null, action: "denied", error: "Failed to vote on card" };
  }
}

export async function deleteCard(
  id: string,
  visitorId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const existing = await db.query.cards.findFirst({
      where: eq(cards.id, id),
    });

    if (!existing) {
      return { success: false, error: "Card not found" };
    }

    // Get session to check permissions
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, existing.sessionId),
    });

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
        (!card.content || card.content.trim() === "") &&
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
