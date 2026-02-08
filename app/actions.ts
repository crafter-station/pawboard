"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, count, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
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
import { getUsername, isClerkUserId, resolveUsernames } from "@/lib/user-utils";

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

// TTL for unclaimed boards (2 days in milliseconds)
const UNCLAIMED_BOARD_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export async function getOrCreateSession(id: string) {
  try {
    let session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      // Check if user is authenticated
      const { userId: clerkId } = await auth();

      // Sessions created by authenticated users don't expire
      const expiresAt = clerkId
        ? null
        : new Date(Date.now() + UNCLAIMED_BOARD_TTL_MS);

      const [newSession] = await db
        .insert(sessions)
        .values({
          id,
          name: generateSessionName(),
          expiresAt,
        })
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
  console.log("[getOrCreateUser] Looking up userId:", userId);

  // Reject Clerk IDs - they shouldn't be stored in users table
  if (isClerkUserId(userId)) {
    console.warn("Attempted to create user for Clerk ID:", userId);
    return { user: null, error: "Clerk users are not stored in database" };
  }

  try {
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    console.log("[getOrCreateUser] Found user:", user);

    if (!user) {
      // Generate username for fingerprint users
      const username = generateUsername();

      console.log(
        "[getOrCreateUser] Creating new user with username:",
        username,
      );

      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          username,
        })
        .returning();
      user = newUser;

      console.log("[getOrCreateUser] Created new user:", newUser);
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
): Promise<{
  username: string | null;
  error: string | null;
}> {
  try {
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
      return { username: null, error: validation.error ?? "Invalid username" };
    }

    const trimmedName = newUsername.trim();

    // Handle Clerk users differently - update via Clerk API only
    if (isClerkUserId(userId)) {
      try {
        const client = await clerkClient();
        await client.users.updateUser(userId, {
          firstName: trimmedName,
        });
        return { username: trimmedName, error: null };
      } catch (clerkError) {
        console.error("Failed to update Clerk username:", clerkError);
        return { username: null, error: "Failed to update username" };
      }
    }

    // Fingerprint users - update in local DB
    const [user] = await db
      .update(users)
      .set({ username: trimmedName })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      return { username: null, error: "User not found" };
    }

    return { username: user.username, error: null };
  } catch (error) {
    console.error("Database error in updateUsername:", error);
    return { username: null, error: "Failed to update username" };
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
  username: string | null;
  error: string | null;
}> {
  console.log("[joinSession] userId:", userId, "sessionId:", sessionId);

  try {
    let username: string;

    if (isClerkUserId(userId)) {
      // Clerk users: fetch username from Clerk API, don't store in DB
      console.log("[joinSession] Clerk user detected, fetching from API");
      username = await getUsername(userId);
    } else {
      // Fingerprint users: ensure they exist in DB
      console.log("[joinSession] Fingerprint user, calling getOrCreateUser");
      const { user, error: userError } = await getOrCreateUser(userId);
      if (userError || !user) {
        console.log("[joinSession] Error creating user:", userError);
        return {
          success: false,
          role: null,
          username: null,
          error: userError ?? "Failed to create user",
        };
      }
      username = user.username;
      console.log("[joinSession] Got username from DB:", username);
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
      return {
        success: true,
        role: existing.role as SessionRole,
        username,
        error: null,
      };
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

    return { success: true, role, username, error: null };
  } catch (error) {
    console.error("Database error in joinSession:", error);
    return {
      success: false,
      role: null,
      username: null,
      error: "Failed to join session",
    };
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

    // Collect creator user IDs for username resolution
    const creatorUserIds = participations
      .map((p) => p.session.participants[0]?.userId)
      .filter((id): id is string => id !== undefined);

    // Resolve usernames
    const usernames = await resolveUsernames(creatorUserIds);

    // Transform the data
    const sessionsData = participations.map((participation) => {
      const creatorUserId = participation.session.participants[0]?.userId;
      return {
        id: participation.session.id,
        name: participation.session.name,
        role: participation.role as SessionRole,
        creatorName: creatorUserId
          ? (usernames.get(creatorUserId) ?? "Unknown")
          : "Unknown",
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

/**
 * Get all sessions for a user, combining both fingerprint and Clerk ID sessions.
 * Returns sessions with metadata about whether participation was anonymous and if claimed.
 */
export async function getAllUserSessions(fingerprintId: string): Promise<{
  sessions: Array<{
    id: string;
    name: string;
    role: SessionRole;
    creatorName: string;
    lastActivityAt: Date;
    lastActiveAt: Date;
    cardCount: number;
    isAnonymous: boolean;
    isClaimed: boolean;
    expiresAt: Date | null;
  }>;
  error: string | null;
}> {
  try {
    const { userId: clerkId } = await auth();

    // Build list of user IDs to query
    const userIds = [fingerprintId];
    if (clerkId && clerkId !== fingerprintId) {
      userIds.push(clerkId);
    }

    // Get all sessions where user is a participant (with any of their IDs)
    const participations = await db.query.sessionParticipants.findMany({
      where: inArray(sessionParticipants.userId, userIds),
      with: {
        session: {
          with: {
            participants: {
              where: eq(sessionParticipants.role, "creator"),
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

    // Collect creator user IDs for username resolution
    const creatorUserIds = participations
      .map((p) => p.session.participants[0]?.userId)
      .filter((id): id is string => id !== undefined);

    // Resolve usernames
    const usernames = await resolveUsernames(creatorUserIds);

    // Deduplicate sessions (same session might appear for both fingerprint and clerk IDs)
    // Keep track of which sessions were accessed anonymously
    const sessionMap = new Map<
      string,
      {
        id: string;
        name: string;
        role: SessionRole;
        creatorName: string;
        lastActivityAt: Date;
        lastActiveAt: Date;
        cardCount: number;
        isAnonymous: boolean;
        isClaimed: boolean;
        expiresAt: Date | null;
      }
    >();

    for (const participation of participations) {
      const sessionId = participation.session.id;
      const isAnonymousParticipation = participation.userId === fingerprintId;
      // A session is claimed if it has no expiration (null expiresAt means permanent)
      const isClaimed = participation.session.expiresAt === null;

      const existing = sessionMap.get(sessionId);

      if (!existing) {
        const creatorUserId = participation.session.participants[0]?.userId;
        sessionMap.set(sessionId, {
          id: sessionId,
          name: participation.session.name,
          role: participation.role as SessionRole,
          creatorName: creatorUserId
            ? (usernames.get(creatorUserId) ?? "Unknown")
            : "Unknown",
          lastActivityAt: participation.session.lastActivityAt,
          lastActiveAt: participation.lastActiveAt,
          cardCount: participation.session.cards.length,
          isAnonymous: isAnonymousParticipation && clerkId !== null,
          isClaimed,
          expiresAt: participation.session.expiresAt,
        });
      } else {
        // Session already exists - update with best values
        // Prefer creator role over participant
        if (participation.role === "creator" && existing.role !== "creator") {
          existing.role = "creator";
        }
        // Use most recent lastActiveAt
        if (participation.lastActiveAt > existing.lastActiveAt) {
          existing.lastActiveAt = participation.lastActiveAt;
        }
        // Mark as anonymous only if the fingerprint participation exists AND user is authenticated
        if (isAnonymousParticipation && clerkId !== null) {
          existing.isAnonymous = true;
        }
      }
    }

    // Convert to array and sort by lastActiveAt (most recent first)
    const sessionsData = Array.from(sessionMap.values());
    sessionsData.sort(
      (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
    );

    return { sessions: sessionsData, error: null };
  } catch (error) {
    console.error("Database error in getAllUserSessions:", error);
    return { sessions: [], error: "Failed to fetch sessions" };
  }
}

export async function getSessionParticipants(
  sessionId: string,
): Promise<{ visitorId: string; username: string; role?: SessionRole }[]> {
  try {
    // Get participants and card creators in parallel
    const [participants, cardCreators] = await Promise.all([
      // Get participants who explicitly joined the session
      db.query.sessionParticipants.findMany({
        where: eq(sessionParticipants.sessionId, sessionId),
      }),
      // Get distinct card creators for this session
      db
        .selectDistinct({
          createdById: cards.createdById,
        })
        .from(cards)
        .where(eq(cards.sessionId, sessionId)),
    ]);

    // Build a map of userId -> role from participants
    const userRoles = new Map<string, SessionRole>();
    for (const p of participants) {
      userRoles.set(p.userId, p.role as SessionRole);
    }

    // Collect all unique user IDs
    const allUserIds = new Set<string>();
    for (const p of participants) {
      allUserIds.add(p.userId);
    }
    for (const c of cardCreators) {
      allUserIds.add(c.createdById);
    }

    // Resolve all usernames
    const usernames = await resolveUsernames([...allUserIds]);

    return Array.from(allUserIds).map((userId) => ({
      visitorId: userId,
      username: usernames.get(userId) ?? "Anonymous",
      role: userRoles.get(userId),
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
  username: string;
};

export async function getCardEditHistory(
  cardId: string,
): Promise<{ history: CardEditHistoryWithUser[]; error: string | null }> {
  try {
    const historyEntries = await db.query.cardEditHistory.findMany({
      where: eq(cardEditHistory.cardId, cardId),
      orderBy: (history, { desc }) => [desc(history.editedAt)],
    });

    // Resolve usernames
    const userIds = historyEntries.map((h) => h.userId);
    const usernames = await resolveUsernames(userIds);

    const history: CardEditHistoryWithUser[] = historyEntries.map((entry) => ({
      id: entry.id,
      cardId: entry.cardId,
      userId: entry.userId,
      editedAt: entry.editedAt,
      username: usernames.get(entry.userId) ?? "Anonymous",
    }));

    return { history, error: null };
  } catch (error) {
    console.error("Database error in getCardEditHistory:", error);
    return { history: [], error: "Failed to get card edit history" };
  }
}

/**
 * Raw version of getCardEditHistory that doesn't resolve usernames.
 * Used by client-side caching to separate history fetch from user resolution.
 */
export async function getCardEditHistoryRaw(cardId: string): Promise<{
  history: Array<{
    id: string;
    cardId: string;
    userId: string;
    editedAt: Date;
  }>;
  error: string | null;
}> {
  try {
    const historyEntries = await db.query.cardEditHistory.findMany({
      where: eq(cardEditHistory.cardId, cardId),
      orderBy: (history, { desc }) => [desc(history.editedAt)],
    });

    return { history: historyEntries, error: null };
  } catch (error) {
    console.error("Database error in getCardEditHistoryRaw:", error);
    return { history: [], error: "Failed to get card edit history" };
  }
}

/**
 * Batch fetch user data by IDs.
 * Handles both Clerk users and fingerprint users.
 * Used by client-side caching to resolve usernames efficiently.
 */
export async function getUsersByIds(userIds: string[]): Promise<{
  users: Array<{ userId: string; username: string }>;
  error: string | null;
}> {
  try {
    const usernames = await resolveUsernames(userIds);
    const users = Array.from(usernames.entries()).map(([userId, username]) => ({
      userId,
      username,
    }));
    return { users, error: null };
  } catch (error) {
    console.error("Error in getUsersByIds:", error);
    return { users: [], error: "Failed to fetch users" };
  }
}

export async function getCardEditors(cardId: string): Promise<{
  editors: Array<{ userId: string; username: string }>;
  error: string | null;
}> {
  try {
    // Get distinct editors ordered by most recent edit
    const historyEntries = await db.query.cardEditHistory.findMany({
      where: eq(cardEditHistory.cardId, cardId),
      orderBy: (history, { desc }) => [desc(history.editedAt)],
    });

    // Get unique user IDs while preserving order (most recent first)
    const seen = new Set<string>();
    const uniqueUserIds: string[] = [];

    for (const entry of historyEntries) {
      if (!seen.has(entry.userId)) {
        seen.add(entry.userId);
        uniqueUserIds.push(entry.userId);
      }
    }

    // Resolve usernames
    const usernames = await resolveUsernames(uniqueUserIds);

    const editors = uniqueUserIds.map((userId) => ({
      userId,
      username: usernames.get(userId) ?? "Anonymous",
    }));

    return { editors, error: null };
  } catch (error) {
    console.error("Database error in getCardEditors:", error);
    return { editors: [], error: "Failed to get card editors" };
  }
}

export async function getSessionCardEditors(sessionId: string): Promise<{
  editors: Record<string, Array<{ userId: string; username: string }>>;
  error: string | null;
}> {
  try {
    // Get all cards for this session first
    const sessionCards = await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
      columns: { id: true },
    });

    if (sessionCards.length === 0) {
      return { editors: {}, error: null };
    }

    const cardIds = sessionCards.map((c) => c.id);

    // Get all edit history for these cards
    const historyEntries = await db.query.cardEditHistory.findMany({
      where: inArray(cardEditHistory.cardId, cardIds),
      orderBy: (history, { desc }) => [desc(history.editedAt)],
    });

    // Collect all unique user IDs
    const allUserIds = [...new Set(historyEntries.map((h) => h.userId))];

    // Resolve usernames
    const usernames = await resolveUsernames(allUserIds);

    // Group by cardId and deduplicate users (preserving order - most recent first)
    const editorsByCard: Record<
      string,
      Array<{ userId: string; username: string }>
    > = {};

    for (const entry of historyEntries) {
      if (!editorsByCard[entry.cardId]) {
        editorsByCard[entry.cardId] = [];
      }
      // Only add if user not already in list for this card
      if (!editorsByCard[entry.cardId].some((e) => e.userId === entry.userId)) {
        editorsByCard[entry.cardId].push({
          userId: entry.userId,
          username: usernames.get(entry.userId) ?? "Anonymous",
        });
      }
    }

    return { editors: editorsByCard, error: null };
  } catch (error) {
    console.error("Database error in getSessionCardEditors:", error);
    return { editors: {}, error: "Failed to fetch editors" };
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
    const clampedWidth = Math.max(180, Math.min(600, Math.round(width)));
    const clampedHeight = Math.max(150, Math.min(400, Math.round(height)));

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
        comments: {
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
      },
      orderBy: (threads, { desc }) => [desc(threads.createdAt)],
    });

    // Collect all user IDs (thread creators and comment creators)
    const userIds = new Set<string>();
    for (const thread of result) {
      userIds.add(thread.createdById);
      for (const comment of thread.comments) {
        userIds.add(comment.createdById);
      }
    }

    // Resolve usernames
    const usernames = await resolveUsernames([...userIds]);

    // Transform to ThreadWithDetails
    const threadsWithDetails: ThreadWithDetails[] = result.map((thread) => ({
      ...thread,
      creatorUsername: usernames.get(thread.createdById) ?? "Anonymous",
      comments: thread.comments.map((comment) => ({
        ...comment,
        creatorUsername: usernames.get(comment.createdById) ?? "Anonymous",
      })),
    }));

    return { threads: threadsWithDetails, error: null };
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

    // Fetch the complete thread with comments
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: {
        comments: {
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
      },
    });

    if (!thread) {
      return { thread: null, error: "Thread not found after creation" };
    }

    // Resolve usernames
    const userIds = [
      thread.createdById,
      ...thread.comments.map((c) => c.createdById),
    ];
    const usernames = await resolveUsernames(userIds);

    const threadWithDetails: ThreadWithDetails = {
      ...thread,
      creatorUsername: usernames.get(thread.createdById) ?? "Anonymous",
      comments: thread.comments.map((comment) => ({
        ...comment,
        creatorUsername: usernames.get(comment.createdById) ?? "Anonymous",
      })),
    };

    return { thread: threadWithDetails, error: null };
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

    // Fetch the comment
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });

    if (!comment) {
      return { comment: null, error: "Comment not found after creation" };
    }

    // Resolve username
    const usernames = await resolveUsernames([comment.createdById]);

    const commentWithCreator: CommentWithCreator = {
      ...comment,
      creatorUsername: usernames.get(comment.createdById) ?? "Anonymous",
    };

    return { comment: commentWithCreator, error: null };
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

// ============================================================================
// Claimable Boards Actions
// ============================================================================

/**
 * Ensure the Clerk user exists in our database.
 * Creates a new user record with the Clerk ID if it doesn't exist.
 * Uses Clerk's name (firstName) when creating the user.
 */
export async function ensureClerkUserExists(): Promise<{
  user: User | null;
  error: string | null;
}> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { user: null, error: "Not authenticated" };
  }

  try {
    // Check if Clerk user already exists in our DB
    let user = await db.query.users.findFirst({
      where: eq(users.id, clerkId),
    });

    if (!user) {
      // Fetch Clerk user to get their name
      let clerkName = generateUsername(); // Fallback
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkId);
        // Clerk stores full name in firstName (single input config)
        clerkName =
          clerkUser.firstName || clerkUser.username || generateUsername();
      } catch (clerkError) {
        console.error("Failed to fetch Clerk user:", clerkError);
        // Continue with generated username
      }

      // Create user with Clerk ID and their Clerk name
      const [newUser] = await db
        .insert(users)
        .values({
          id: clerkId,
          username: clerkName,
        })
        .returning();
      user = newUser;
    }

    return { user, error: null };
  } catch (error) {
    console.error("Database error in ensureClerkUserExists:", error);
    return { user: null, error: "Failed to ensure user exists" };
  }
}

/**
 * Check if a fingerprint has any contributions on a specific board.
 * Returns stats about what they did (cards created, comments, etc.)
 */
export async function getAnonymousHistoryOnBoard(
  sessionId: string,
  fingerprintId: string,
): Promise<{
  hasHistory: boolean;
  stats: {
    role: SessionRole | null;
    cardsCreated: number;
    commentsCreated: number;
  } | null;
}> {
  try {
    // Check if this fingerprint has any activity on this board
    const participation = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, fingerprintId),
      ),
    });

    if (!participation) {
      return { hasHistory: false, stats: null };
    }

    // Get stats about what they did
    const [cardCountResult] = await db
      .select({ count: count() })
      .from(cards)
      .where(
        and(
          eq(cards.sessionId, sessionId),
          eq(cards.createdById, fingerprintId),
        ),
      );

    // Get comment count for this board's threads
    const boardThreads = await db.query.threads.findMany({
      where: eq(threads.sessionId, sessionId),
      columns: { id: true },
    });
    const threadIds = boardThreads.map((t) => t.id);

    let commentCountValue = 0;
    if (threadIds.length > 0) {
      const [commentCountResult] = await db
        .select({ count: count() })
        .from(comments)
        .where(
          and(
            inArray(comments.threadId, threadIds),
            eq(comments.createdById, fingerprintId),
          ),
        );
      commentCountValue = commentCountResult?.count ?? 0;
    }

    return {
      hasHistory: true,
      stats: {
        role: participation.role as SessionRole,
        cardsCreated: cardCountResult?.count ?? 0,
        commentsCreated: commentCountValue,
      },
    };
  } catch (error) {
    console.error("Database error in getAnonymousHistoryOnBoard:", error);
    return { hasHistory: false, stats: null };
  }
}

/**
 * Migrate anonymous contributions on a specific board to the authenticated Clerk user.
 * This transfers ownership of cards, comments, votes, reactions, etc.
 */
export async function claimAnonymousWorkOnBoard(
  sessionId: string,
  fingerprintId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Ensure Clerk user exists
    const { error: userError } = await ensureClerkUserExists();
    if (userError) {
      return { success: false, error: userError };
    }

    await db.transaction(async (tx) => {
      // 1. Handle session participation transfer
      const existingClerkParticipation =
        await tx.query.sessionParticipants.findFirst({
          where: and(
            eq(sessionParticipants.sessionId, sessionId),
            eq(sessionParticipants.userId, clerkId),
          ),
        });

      const anonParticipation = await tx.query.sessionParticipants.findFirst({
        where: and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, fingerprintId),
        ),
      });

      if (anonParticipation && !existingClerkParticipation) {
        // Transfer the participation (keeps role like "creator")
        await tx
          .update(sessionParticipants)
          .set({ userId: clerkId })
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, fingerprintId),
            ),
          );
      } else if (anonParticipation && existingClerkParticipation) {
        // Clerk already participating, merge roles (keep creator if either has it)
        if (
          anonParticipation.role === "creator" &&
          existingClerkParticipation.role !== "creator"
        ) {
          await tx
            .update(sessionParticipants)
            .set({ role: "creator" })
            .where(
              and(
                eq(sessionParticipants.sessionId, sessionId),
                eq(sessionParticipants.userId, clerkId),
              ),
            );
        }
        // Delete anon participation since Clerk user already exists
        await tx
          .delete(sessionParticipants)
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, fingerprintId),
            ),
          );
      }

      // 2. Transfer cards created on this board
      await tx
        .update(cards)
        .set({ createdById: clerkId })
        .where(
          and(
            eq(cards.sessionId, sessionId),
            eq(cards.createdById, fingerprintId),
          ),
        );

      // 3. Transfer card edit history on this board
      await tx.execute(sql`
        UPDATE card_edit_history 
        SET user_id = ${clerkId}
        WHERE user_id = ${fingerprintId}
        AND card_id IN (SELECT id FROM cards WHERE session_id = ${sessionId})
      `);

      // 4. Transfer threads created on this board
      await tx
        .update(threads)
        .set({ createdById: clerkId })
        .where(
          and(
            eq(threads.sessionId, sessionId),
            eq(threads.createdById, fingerprintId),
          ),
        );

      // 5. Transfer comments on this board's threads
      await tx.execute(sql`
        UPDATE comments 
        SET created_by_id = ${clerkId}
        WHERE created_by_id = ${fingerprintId}
        AND thread_id IN (SELECT id FROM threads WHERE session_id = ${sessionId})
      `);

      // 6. Update votes in cards.votedBy (JSONB array) - only for this board's cards
      // Use DISTINCT to prevent duplicates when user voted as both fingerprint and Clerk ID
      await tx.execute(sql`
        UPDATE cards 
        SET voted_by = (
          SELECT COALESCE(jsonb_agg(DISTINCT replaced_elem), '[]'::jsonb)
          FROM (
            SELECT CASE WHEN elem = ${fingerprintId} THEN ${clerkId} ELSE elem END AS replaced_elem
            FROM jsonb_array_elements_text(voted_by) AS elem
          ) subq
        )
        WHERE session_id = ${sessionId}
        AND voted_by @> ${JSON.stringify([fingerprintId])}::jsonb
      `);

      // 7. Update reactions in cards.reactions (JSONB object) - only for this board's cards
      // Use DISTINCT to prevent duplicates when user reacted as both fingerprint and Clerk ID
      await tx.execute(sql`
        UPDATE cards
        SET reactions = (
          SELECT COALESCE(jsonb_object_agg(
            key,
            (SELECT COALESCE(jsonb_agg(DISTINCT replaced_elem), '[]'::jsonb) 
             FROM (
               SELECT CASE WHEN elem = ${fingerprintId} THEN ${clerkId} ELSE elem END AS replaced_elem
               FROM jsonb_array_elements_text(value) AS elem
             ) subq)
          ), '{}'::jsonb)
          FROM jsonb_each(reactions)
        )
        WHERE session_id = ${sessionId}
        AND reactions::text LIKE ${`%${fingerprintId}%`}
      `);
    });

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in claimAnonymousWorkOnBoard:", error);
    return { success: false, error: "Failed to claim anonymous work" };
  }
}

/**
 * Join a session as the authenticated Clerk user (without migrating anonymous work).
 * Used when user chooses to "start fresh" instead of claiming their anonymous history.
 */
export async function joinSessionAsClerkUser(sessionId: string): Promise<{
  success: boolean;
  role: SessionRole | null;
  error: string | null;
}> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { success: false, role: null, error: "Not authenticated" };
  }

  try {
    // Ensure user exists
    const { error: userError } = await ensureClerkUserExists();
    if (userError) {
      return { success: false, role: null, error: userError };
    }

    // Check if already participating
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, clerkId),
      ),
    });

    if (existing) {
      // Already a participant
      return { success: true, role: existing.role as SessionRole, error: null };
    }

    // Join as new participant
    await db.insert(sessionParticipants).values({
      userId: clerkId,
      sessionId,
      role: "participant",
    });

    return { success: true, role: "participant", error: null };
  } catch (error) {
    console.error("Database error in joinSessionAsClerkUser:", error);
    return { success: false, role: null, error: "Failed to join session" };
  }
}

/**
 * Claim a session (board) to remove its expiration TTL.
 * This replaces the fingerprint ID with the Clerk ID in all relevant tables.
 * Only the session creator (identified by fingerprintId) can claim a board.
 */
export async function claimSession(
  sessionId: string,
  fingerprintId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Ensure Clerk user exists before claiming
    const { error: userError } = await ensureClerkUserExists();
    if (userError) {
      return { success: false, error: userError };
    }

    // Claim the session by replacing fingerprint with Clerk ID
    // All checks are inside the transaction to prevent TOCTOU race conditions
    await db.transaction(async (tx) => {
      // Find the creator participation with fingerprint (inside transaction)
      const creatorParticipation = await tx.query.sessionParticipants.findFirst(
        {
          where: and(
            eq(sessionParticipants.sessionId, sessionId),
            eq(sessionParticipants.userId, fingerprintId),
            eq(sessionParticipants.role, "creator"),
          ),
        },
      );

      if (!creatorParticipation) {
        throw new Error("You are not the creator of this session");
      }

      // Check if Clerk user is already a participant (inside transaction)
      const existingClerkParticipant =
        await tx.query.sessionParticipants.findFirst({
          where: and(
            eq(sessionParticipants.sessionId, sessionId),
            eq(sessionParticipants.userId, clerkId),
          ),
        });

      // Handle session participants based on whether Clerk user already exists
      if (existingClerkParticipant) {
        // Clerk user already joined - delete fingerprint record and update Clerk's role to creator
        await tx
          .delete(sessionParticipants)
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, fingerprintId),
            ),
          );

        // Update Clerk participant's role to creator
        await tx
          .update(sessionParticipants)
          .set({ role: creatorParticipation.role })
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, clerkId),
            ),
          );
      } else {
        // No Clerk participant yet - just update fingerprint to Clerk ID
        await tx
          .update(sessionParticipants)
          .set({ userId: clerkId })
          .where(
            and(
              eq(sessionParticipants.sessionId, sessionId),
              eq(sessionParticipants.userId, fingerprintId),
            ),
          );
      }

      // Replace fingerprint with Clerk ID in cards
      await tx
        .update(cards)
        .set({ createdById: clerkId })
        .where(
          and(
            eq(cards.sessionId, sessionId),
            eq(cards.createdById, fingerprintId),
          ),
        );

      // Replace fingerprint with Clerk ID in threads
      await tx
        .update(threads)
        .set({ createdById: clerkId })
        .where(
          and(
            eq(threads.sessionId, sessionId),
            eq(threads.createdById, fingerprintId),
          ),
        );

      // Replace fingerprint with Clerk ID in comments on this session's threads
      await tx.execute(sql`
        UPDATE comments 
        SET created_by_id = ${clerkId}
        WHERE created_by_id = ${fingerprintId}
        AND thread_id IN (SELECT id FROM threads WHERE session_id = ${sessionId})
      `);

      // Replace fingerprint with Clerk ID in card edit history
      await tx.execute(sql`
        UPDATE card_edit_history 
        SET user_id = ${clerkId}
        WHERE user_id = ${fingerprintId}
        AND card_id IN (SELECT id FROM cards WHERE session_id = ${sessionId})
      `);

      // Update votes in cards.votedBy (JSONB array)
      // Use DISTINCT to prevent duplicates when user voted as both fingerprint and Clerk ID
      await tx.execute(sql`
        UPDATE cards 
        SET voted_by = (
          SELECT COALESCE(jsonb_agg(DISTINCT replaced_elem), '[]'::jsonb)
          FROM (
            SELECT CASE WHEN elem = ${fingerprintId} THEN ${clerkId} ELSE elem END AS replaced_elem
            FROM jsonb_array_elements_text(voted_by) AS elem
          ) subq
        )
        WHERE session_id = ${sessionId}
        AND voted_by @> ${JSON.stringify([fingerprintId])}::jsonb
      `);

      // Update reactions in cards.reactions (JSONB object)
      // Use DISTINCT to prevent duplicates when user reacted as both fingerprint and Clerk ID
      await tx.execute(sql`
        UPDATE cards
        SET reactions = (
          SELECT COALESCE(jsonb_object_agg(
            key,
            (SELECT COALESCE(jsonb_agg(DISTINCT replaced_elem), '[]'::jsonb) 
             FROM (
               SELECT CASE WHEN elem = ${fingerprintId} THEN ${clerkId} ELSE elem END AS replaced_elem
               FROM jsonb_array_elements_text(value) AS elem
             ) subq)
          ), '{}'::jsonb)
          FROM jsonb_each(reactions)
        )
        WHERE session_id = ${sessionId}
        AND reactions::text LIKE ${`%${fingerprintId}%`}
      `);

      // Remove expiration (claiming makes it permanent)
      await tx
        .update(sessions)
        .set({ expiresAt: null })
        .where(eq(sessions.id, sessionId));
    });

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in claimSession:", error);
    // Return the specific error message if it's a known error
    if (error instanceof Error) {
      if (error.message === "You are not the creator of this session") {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "Failed to claim session" };
  }
}

/**
 * Get all sessions where the authenticated user is the creator.
 * This replaces the old getClaimedSessions which relied on claimedByUserId.
 */
export async function getClaimedSessions(): Promise<{
  sessions: Array<{
    id: string;
    name: string;
    createdAt: Date;
    lastActivityAt: Date;
    cardCount: number;
  }>;
  error: string | null;
}> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { sessions: [], error: "Not authenticated" };
  }

  try {
    // Get sessions where the Clerk user is the creator
    const creatorParticipations = await db.query.sessionParticipants.findMany({
      where: and(
        eq(sessionParticipants.userId, clerkId),
        eq(sessionParticipants.role, "creator"),
      ),
      with: {
        session: {
          with: {
            cards: {
              columns: { id: true },
            },
          },
        },
      },
    });

    const result = creatorParticipations.map((p) => ({
      id: p.session.id,
      name: p.session.name,
      createdAt: p.session.createdAt,
      lastActivityAt: p.session.lastActivityAt,
      cardCount: p.session.cards.length,
    }));

    // Sort by lastActivityAt (most recent first)
    result.sort(
      (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
    );

    return { sessions: result, error: null };
  } catch (error) {
    console.error("Database error in getClaimedSessions:", error);
    return { sessions: [], error: "Failed to fetch claimed sessions" };
  }
}

/**
 * Delete expired unclaimed sessions.
 * This is called by a cron job to clean up old anonymous boards.
 */
// Batch size limit to avoid overwhelming the database
const CLEANUP_BATCH_SIZE = 100;

export async function deleteExpiredSessions(): Promise<{
  deletedCount: number;
  error: string | null;
}> {
  try {
    // Get expired sessions with a batch size limit
    const expiredSessions = await db.query.sessions.findMany({
      where: and(
        isNotNull(sessions.expiresAt),
        lt(sessions.expiresAt, new Date()),
      ),
      columns: { id: true },
      limit: CLEANUP_BATCH_SIZE,
    });

    if (expiredSessions.length === 0) {
      return { deletedCount: 0, error: null };
    }

    // Delete expired sessions (cascade will handle related data)
    await db.delete(sessions).where(
      inArray(
        sessions.id,
        expiredSessions.map((s) => s.id),
      ),
    );

    return { deletedCount: expiredSessions.length, error: null };
  } catch (error) {
    console.error("Database error in deleteExpiredSessions:", error);
    return { deletedCount: 0, error: "Failed to delete expired sessions" };
  }
}
