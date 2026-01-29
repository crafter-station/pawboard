import { z } from "zod";

/**
 * Validation schemas for API routes.
 */

// Chat API - loose validation on messages since UIMessage is complex
export const chatRequestSchema = z.object({
  messages: z.array(z.unknown()),
  sessionId: z
    .string()
    .min(1, "Session ID is required")
    .max(50, "Session ID too long"),
  userId: z.string().min(1, "User ID is required").max(100, "User ID too long"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Refine API
export const refineRequestSchema = z.object({
  selectedText: z
    .string()
    .min(1, "Selected text is required")
    .max(10000, "Selected text too long"),
  fullContent: z.unknown().optional(),
  cardId: z.string().optional(),
  userId: z.string().optional(),
});

export type RefineRequest = z.infer<typeof refineRequestSchema>;

// Embeddings API (internal)
export const embeddingsRequestSchema = z.object({
  cardId: z.string().min(1, "Card ID is required"),
  content: z.string(),
});

export type EmbeddingsRequest = z.infer<typeof embeddingsRequestSchema>;

/**
 * Helper to validate request body against a schema.
 * Returns either the validated data or an error response.
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ data: T; error: null } | { data: null; error: Response }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");

      return {
        data: null,
        error: Response.json(
          { error: `Validation failed: ${errors}` },
          { status: 400 },
        ),
      };
    }

    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: Response.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}
