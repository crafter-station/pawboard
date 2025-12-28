import { pgTable, text, timestamp, real, integer, jsonb } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdById: text("created_by_id").notNull(),
  createdBy: text("created_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

