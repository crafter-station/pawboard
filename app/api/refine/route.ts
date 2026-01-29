import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cards,
  sessionParticipants,
  sessions,
  type TiptapContent,
} from "@/db/schema";
import { canRefine } from "@/lib/permissions";
import {
  getClientIdentifier,
  rateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { extractTextFromTiptap } from "@/lib/tiptap-utils";
import { refineRequestSchema, validateRequest } from "@/lib/validations";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  // Rate limit check
  const clientId = getClientIdentifier(req);
  const { success, reset, limit, remaining } = await rateLimit(clientId, "ai");
  if (!success) {
    return rateLimitResponse(reset, limit, remaining);
  }

  try {
    // Validate request body
    const { data, error: validationError } = await validateRequest(
      req,
      refineRequestSchema,
    );
    if (validationError) return validationError;

    const { selectedText, fullContent, cardId, userId } = data;

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

      // Get user role in session
      const participant = await db.query.sessionParticipants.findFirst({
        where: and(
          eq(sessionParticipants.userId, userId),
          eq(sessionParticipants.sessionId, card.sessionId),
        ),
      });
      const userRole =
        (participant?.role as "creator" | "participant") ?? "participant";

      if (!canRefine(session, card, userId, userRole)) {
        return Response.json(
          { error: "You don't have permission to refine this card" },
          { status: 403 },
        );
      }
    }

    // Extract full text for context
    const fullText = fullContent
      ? extractTextFromTiptap(fullContent as TiptapContent)
      : selectedText;

    const prompt = `You are refining a portion of text within a larger document.

## Full Document Context:
${fullText}

## Selected Text to Refine:
"${selectedText}"

## Instructions:
1. Detect the language and respond in the same language
2. Refine ONLY the selected text, making it clearer and more concise
3. Keep the same meaning and tone as the original
4. Consider the surrounding context when refining
5. You can use formatting: bold, italic, bullet lists
6. Be concise - the refined text should be similar length or shorter
7. Return ONLY valid JSON, no markdown code blocks, no explanation

Return the refined content as a Tiptap document JSON structure.

For simple text, return:
{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Your refined text"}]}]}

For bold text, add marks:
{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bold text","marks":[{"type":"bold"}]}]}]}

For bullet list:
{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"First item"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Second item"}]}]}]}]}

Return ONLY the JSON object, nothing else:`;

    const { text } = await generateText({
      model: groq("openai/gpt-oss-20b"),
      prompt,
      temperature: 0.3,
    });

    // Parse the JSON response
    let refined: TiptapContent;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      refined = JSON.parse(cleanedText);

      // Validate basic structure
      if (refined.type !== "doc" || !Array.isArray(refined.content)) {
        throw new Error("Invalid Tiptap structure");
      }
    } catch {
      console.error("Failed to parse AI response as JSON:", text);
      // Fallback: wrap the text in a simple paragraph structure
      refined = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: text.trim() }],
          },
        ],
      };
    }

    return Response.json({ refined });
  } catch (error) {
    console.error("Refine error:", error);
    return Response.json({ error: "Failed to refine text" }, { status: 500 });
  }
}
