import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

// Tiptap rich text content type
export type TiptapContent = {
  type: "doc";
  content?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  }>;
};

// Default empty document for new cards
export const DEFAULT_TIPTAP_CONTENT: TiptapContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

// Tables

export const users = pgTable("users", {
  id: text("id").primaryKey(), // visitorId from fingerprint
  username: text("username").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
});

export const sessionParticipants = pgTable(
  "session_participants",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("participant"), // "creator" | "participant"
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sessionId] }),
    index("participants_session_idx").on(table.sessionId),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    content: jsonb("content")
      .$type<TiptapContent>()
      .notNull()
      .default({ type: "doc", content: [{ type: "paragraph" }] }),
    color: text("color").notNull().default("#fef08a"),
    x: real("x").notNull().default(100),
    y: real("y").notNull().default(100),
    width: integer("width").notNull().default(224),
    height: integer("height").notNull().default(160),
    votes: integer("votes").notNull().default(0),
    votedBy: jsonb("voted_by").$type<string[]>().notNull().default([]),
    reactions: jsonb("reactions")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    embedding: vector("embedding", { dimensions: 1536 }), // AI embedding for content similarity (text-embedding-3-small)
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // HNSW index for fast cosine similarity search
    index("cards_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    // Index for fast session card lookups
    index("cards_session_idx").on(table.sessionId),
  ],
);

export const cardEditHistory = pgTable(
  "card_edit_history",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    editedAt: timestamp("edited_at").defaultNow().notNull(),
  },
  (table) => [index("card_edit_history_card_idx").on(table.cardId)],
);

// Comment threads - can be on canvas (x,y) or attached to a card
export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    x: real("x"), // Canvas position (null if card-attached)
    y: real("y"),
    cardId: text("card_id").references(() => cards.id, { onDelete: "cascade" }), // Card attachment (null if canvas position)
    isResolved: boolean("is_resolved").notNull().default(false),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("threads_session_idx").on(table.sessionId),
    index("threads_card_idx").on(table.cardId),
  ],
);

// Individual comments within a thread
export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("comments_thread_idx").on(table.threadId),
    index("comments_created_at_idx").on(table.createdAt),
  ],
);

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(sessionParticipants),
  cards: many(cards),
  cardEdits: many(cardEditHistory),
  threads: many(threads),
  comments: many(comments),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  participants: many(sessionParticipants),
  cards: many(cards),
  threads: many(threads),
}));

export const sessionParticipantsRelations = relations(
  sessionParticipants,
  ({ one }) => ({
    user: one(users, {
      fields: [sessionParticipants.userId],
      references: [users.id],
    }),
    session: one(sessions, {
      fields: [sessionParticipants.sessionId],
      references: [sessions.id],
    }),
  }),
);

export const cardsRelations = relations(cards, ({ one, many }) => ({
  session: one(sessions, {
    fields: [cards.sessionId],
    references: [sessions.id],
  }),
  creator: one(users, {
    fields: [cards.createdById],
    references: [users.id],
  }),
  editHistory: many(cardEditHistory),
  threads: many(threads),
}));

export const cardEditHistoryRelations = relations(
  cardEditHistory,
  ({ one }) => ({
    card: one(cards, {
      fields: [cardEditHistory.cardId],
      references: [cards.id],
    }),
    user: one(users, {
      fields: [cardEditHistory.userId],
      references: [users.id],
    }),
  }),
);

export const threadsRelations = relations(threads, ({ one, many }) => ({
  session: one(sessions, {
    fields: [threads.sessionId],
    references: [sessions.id],
  }),
  card: one(cards, {
    fields: [threads.cardId],
    references: [cards.id],
  }),
  creator: one(users, {
    fields: [threads.createdById],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  thread: one(threads, {
    fields: [comments.threadId],
    references: [threads.id],
  }),
  creator: one(users, {
    fields: [comments.createdById],
    references: [users.id],
  }),
}));

// Types

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionRole = "creator" | "participant";
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;
export type NewSessionParticipant = typeof sessionParticipants.$inferInsert;
export type CardEditHistoryEntry = typeof cardEditHistory.$inferSelect;
export type NewCardEditHistoryEntry = typeof cardEditHistory.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

// Extended types with relations (for hooks/components)
export type CommentWithCreator = Comment & {
  creator: Pick<User, "id" | "username">;
};

export type ThreadWithDetails = Thread & {
  comments: CommentWithCreator[];
  creator: Pick<User, "id" | "username">;
};
