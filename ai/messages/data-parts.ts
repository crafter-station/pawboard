import { z } from "zod";

export const errorSchema = z.object({
  message: z.string(),
});

export const dataPartSchema = z.object({
  "create-card": z.object({
    cardId: z.string().optional(),
    content: z.string().optional(),
    status: z.enum(["creating", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "edit-card": z.object({
    cardId: z.string(),
    status: z.enum(["editing", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "delete-cards": z.object({
    cardIds: z.array(z.string()),
    deletedCount: z.number().optional(),
    status: z.enum(["deleting", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "move-cards": z.object({
    cardIds: z.array(z.string()),
    status: z.enum(["moving", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "change-color": z.object({
    cardIds: z.array(z.string()),
    color: z.string().optional(),
    status: z.enum(["changing", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "summarize-cards": z.object({
    cardCount: z.number().optional(),
    summary: z.string().optional(),
    status: z.enum(["summarizing", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "find-similar": z.object({
    query: z.string().optional(),
    results: z
      .array(
        z.object({
          cardId: z.string(),
          content: z.string(),
          similarity: z.number(),
        }),
      )
      .optional(),
    status: z.enum(["searching", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "cluster-cards": z.object({
    clusterCount: z.number().optional(),
    cardsProcessed: z.number().optional(),
    status: z.enum(["clustering", "done", "error"]),
    error: errorSchema.optional(),
  }),
});

export type DataPart = z.infer<typeof dataPartSchema>;
