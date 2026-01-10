import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

interface EmbeddingRequest {
  cardId: string;
  content: string;
}

/**
 * POST /api/embeddings
 *
 * Internal endpoint to generate and save embeddings for a card.
 * Authenticated via internal secret key.
 *
 * Called in the background after card content is updated.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Validate internal secret
    const authHeader = req.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (!INTERNAL_SECRET) {
      console.error("INTERNAL_API_SECRET not configured");
      return Response.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      );
    }

    if (providedSecret !== INTERNAL_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cardId, content }: EmbeddingRequest = await req.json();

    if (!cardId) {
      return Response.json({ error: "Missing cardId" }, { status: 400 });
    }

    // If content is empty, set embedding to null
    if (!content || content.trim().length === 0) {
      await db
        .update(cards)
        .set({ embedding: null })
        .where(eq(cards.id, cardId));

      return Response.json({ success: true, embedding: null });
    }

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Save to database
    await db.update(cards).set({ embedding }).where(eq(cards.id, cardId));

    return Response.json({ success: true, dimensions: embedding.length });
  } catch (error) {
    console.error("Embedding generation error:", error);

    // Don't expose internal errors
    return Response.json(
      { error: "Failed to generate embedding" },
      { status: 500 },
    );
  }
}
