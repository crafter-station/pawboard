import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { boardFiles, sessionParticipants } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "board-files";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!fileId) {
      return Response.json({ error: "No fileId provided" }, { status: 400 });
    }
    if (!userId) {
      return Response.json({ error: "No userId provided" }, { status: 400 });
    }

    // Find the file
    const file = await db.query.boardFiles.findFirst({
      where: eq(boardFiles.id, fileId),
    });

    if (!file) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    // Verify user is a session participant
    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, file.sessionId),
      ),
    });

    if (!participant) {
      return Response.json(
        { error: "You must be a participant in this session to delete files" },
        { status: 403 },
      );
    }

    // Only the uploader or session creator can delete files
    const isUploader = file.uploadedById === userId;
    const isCreator = participant.role === "creator";

    if (!isUploader && !isCreator) {
      return Response.json(
        { error: "Only the file uploader or session creator can delete files" },
        { status: 403 },
      );
    }

    // Delete from Supabase Storage
    const supabase = createAdminClient();
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([file.storagePath]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue with DB deletion even if storage delete fails
      // The file might have already been deleted from storage
    }

    // Delete from database (cascades to file_chunks due to foreign key)
    await db.delete(boardFiles).where(eq(boardFiles.id, fileId));

    return Response.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("File delete error:", error);
    return Response.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
