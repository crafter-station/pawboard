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

// Permission types
export type MovePermission = "creator" | "everyone";
export type DeletePermission = "creator" | "everyone";

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
  movePermission: text("move_permission")
    .$type<MovePermission>()
    .notNull()
    .default("creator"),
  deletePermission: text("delete_permission")
    .$type<DeletePermission>()
    .notNull()
    .default("creator"),
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
  (table) => [primaryKey({ columns: [table.userId, table.sessionId] })],
);

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    color: text("color").notNull().default("#fef08a"),
    x: real("x").notNull().default(100),
    y: real("y").notNull().default(100),
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
  ],
);

// Ingestion status type
export type IngestionStatus = "pending" | "processing" | "completed" | "failed";

// Board files - stores metadata about uploaded files
export const boardFiles = pgTable("board_files", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(), // Original filename
  mimeType: text("mime_type").notNull(), // text/plain or text/markdown
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(), // Supabase storage path
  uploadedById: text("uploaded_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  // Ingestion status
  ingestionStatus: text("ingestion_status")
    .$type<IngestionStatus>()
    .notNull()
    .default("pending"),
  ingestionError: text("ingestion_error"), // Error message if failed
  processedAt: timestamp("processed_at"), // When ingestion completed
});

// File chunks - stores text chunks with embeddings for semantic search
export const fileChunks = pgTable(
  "file_chunks",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => boardFiles.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(), // Order in file
    content: text("content").notNull(), // The actual text chunk
    embedding: vector("embedding", { dimensions: 1536 }), // text-embedding-3-small
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // HNSW index for fast cosine similarity search
    index("file_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(sessionParticipants),
  cards: many(cards),
  uploadedFiles: many(boardFiles),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  participants: many(sessionParticipants),
  cards: many(cards),
  files: many(boardFiles),
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

export const cardsRelations = relations(cards, ({ one }) => ({
  session: one(sessions, {
    fields: [cards.sessionId],
    references: [sessions.id],
  }),
  creator: one(users, {
    fields: [cards.createdById],
    references: [users.id],
  }),
}));

export const boardFilesRelations = relations(boardFiles, ({ one, many }) => ({
  session: one(sessions, {
    fields: [boardFiles.sessionId],
    references: [sessions.id],
  }),
  uploader: one(users, {
    fields: [boardFiles.uploadedById],
    references: [users.id],
  }),
  chunks: many(fileChunks),
}));

export const fileChunksRelations = relations(fileChunks, ({ one }) => ({
  file: one(boardFiles, {
    fields: [fileChunks.fileId],
    references: [boardFiles.id],
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
export type BoardFile = typeof boardFiles.$inferSelect;
export type NewBoardFile = typeof boardFiles.$inferInsert;
export type FileChunk = typeof fileChunks.$inferSelect;
export type NewFileChunk = typeof fileChunks.$inferInsert;
