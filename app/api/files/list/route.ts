import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boardFiles, sessionParticipants } from "@/db/schema";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");

    // Validate required fields
    if (!sessionId) {
      return Response.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    // Verify user is a session participant
    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, sessionId),
      ),
    });

    if (!participant) {
      return Response.json(
        { error: "You must be a participant in this session to view files" },
        { status: 403 },
      );
    }

    // Get all files for the session
    const files = await db.query.boardFiles.findMany({
      where: eq(boardFiles.sessionId, sessionId),
      orderBy: [desc(boardFiles.uploadedAt)],
    });

    return Response.json({ files });
  } catch (error) {
    console.error("File list error:", error);
    return Response.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}
