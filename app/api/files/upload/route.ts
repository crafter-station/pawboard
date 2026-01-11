import { tasks } from "@trigger.dev/sdk/v3";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import type { NewBoardFile } from "@/db/schema";
import { boardFiles, sessionParticipants } from "@/db/schema";
import {
  checkBoardFileLimit,
  sanitizeFilename,
  validateFile,
} from "@/lib/files/validation";
import { generateFileId } from "@/lib/nanoid";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ingestFileTask } from "../../../../src/trigger/ingest-file";

const BUCKET_NAME = "board-files";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const userId = formData.get("userId") as string | null;

    // Validate required fields
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!sessionId) {
      return Response.json({ error: "No sessionId provided" }, { status: 400 });
    }
    if (!userId) {
      return Response.json({ error: "No userId provided" }, { status: 400 });
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
        { error: "You must be a participant in this session to upload files" },
        { status: 403 },
      );
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Check file limit for this board
    const existingFilesCount = await db
      .select()
      .from(boardFiles)
      .where(eq(boardFiles.sessionId, sessionId))
      .then((files) => files.length);

    const limitCheck = checkBoardFileLimit(existingFilesCount);
    if (!limitCheck.valid) {
      return Response.json({ error: limitCheck.error }, { status: 400 });
    }

    // Generate file ID and storage path
    const fileId = generateFileId();
    const sanitizedFilename = sanitizeFilename(file.name);
    const storagePath = `${sessionId}/${fileId}/${sanitizedFilename}`;

    // Upload to Supabase Storage
    const supabase = createAdminClient();
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: validation.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return Response.json(
        { error: "Failed to upload file to storage" },
        { status: 500 },
      );
    }

    // Create database record
    const newFile: NewBoardFile = {
      id: fileId,
      sessionId,
      filename: file.name,
      mimeType: validation.mimeType!,
      sizeBytes: file.size,
      storagePath,
      uploadedById: userId,
      ingestionStatus: "pending",
    };

    const [insertedFile] = await db
      .insert(boardFiles)
      .values(newFile)
      .returning();

    // Trigger ingestion task
    try {
      await tasks.trigger<typeof ingestFileTask>("ingest-file", {
        fileId: insertedFile.id,
      });
    } catch (triggerError) {
      console.error("Failed to trigger ingestion task:", triggerError);
      // Don't fail the upload - we can retry ingestion later
      // Update status to indicate trigger failed
      await db
        .update(boardFiles)
        .set({
          ingestionStatus: "failed",
          ingestionError: "Failed to start ingestion task",
        })
        .where(eq(boardFiles.id, insertedFile.id));
    }

    return Response.json({
      file: insertedFile,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return Response.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
