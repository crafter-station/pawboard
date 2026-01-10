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
export type WorkspaceTier = "free" | "pro";

// Tables

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(), // Clerk userId (set on upgrade)
  tier: text("tier").$type<WorkspaceTier>().notNull().default("free"),
  polarCustomerId: text("polar_customer_id"),
  polarSubscriptionId: text("polar_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usageMetrics = pgTable("usage_metrics", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  aiInsightsUsed: integer("ai_insights_used").notNull().default(0),
  boardsCreated: integer("boards_created").notNull().default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
});

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
  workspaceId: text("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  isPro: boolean("is_pro").notNull().default(false), // For single board pro purchases
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
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  sessions: many(sessions),
  usageMetrics: many(usageMetrics),
}));

export const usageMetricsRelations = relations(usageMetrics, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [usageMetrics.workspaceId],
    references: [workspaces.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(sessionParticipants),
  cards: many(cards),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sessions.workspaceId],
    references: [workspaces.id],
  }),
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

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type UsageMetric = typeof usageMetrics.$inferSelect;
export type NewUsageMetric = typeof usageMetrics.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionRole = "creator" | "participant";
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;
export type NewSessionParticipant = typeof sessionParticipants.$inferInsert;
