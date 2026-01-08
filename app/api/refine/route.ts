import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, sessions } from "@/db/schema";
import { canRefine } from "@/lib/permissions";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text, cardId, userId } = await req.json();

    if (!text || text.trim().length === 0) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    // If cardId and userId are provided, validate permissions
    if (cardId && userId) {
      const card = await db.query.cards.findFirst({
        where: eq(cards.id, cardId),
      });

      if (!card) {
        return Response.json({ error: "Card not found" }, { status: 404 });
      }

      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, card.sessionId),
      });

      if (!session) {
        return Response.json({ error: "Session not found" }, { status: 404 });
      }

      if (!canRefine(session, card, userId)) {
        return Response.json(
          { error: "You don't have permission to refine this card" },
          { status: 403 },
        );
      }
    }

    // Strip HTML tags from input if present
    const plainText = text.replace(/<[^>]*>/g, "").trim();

    const prompt = [
      "Detect the language of the input text. Respond ONLY in that same language.",
      "Restructure and clarify the idea without changing its original meaning.",
      "Make it clearer and easier to read. You can use:",
      "- Short paragraphs (wrap in <p> tags)",
      "- Bullet points (use <ul><li> tags)",
      "- Bold text for key phrases (use <strong> tags)",
      "Choose the best format for the content. Be concise. Output only the refined text as valid HTML.",
      "Use ONLY these tags: <p>, <ul>, <ol>, <li>, <strong>, <em>. Do NOT use markdown.",
      "",
      `Input: "${plainText}"`,
      "",
      "Refined HTML:",
    ].join("\n");

    const { text: refined } = await generateText({
      model: groq("openai/gpt-oss-20b"),
      prompt,
      temperature: 0.3,
    });

    return Response.json({ refined: refined.trim() });
  } catch (error) {
    console.error("Refine error:", error);
    return Response.json({ error: "Failed to refine text" }, { status: 500 });
  }
}
