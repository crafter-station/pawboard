import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
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
  },
  (table) => [primaryKey({ columns: [table.userId, table.sessionId] })],
);

export const cards = pgTable("cards", {
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
  hidden: boolean("hidden").notNull().default(false),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(sessionParticipants),
  cards: many(cards),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  participants: many(sessionParticipants),
  cards: many(cards),
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
