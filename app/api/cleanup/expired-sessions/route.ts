import { NextResponse } from "next/server";
import { deleteExpiredSessions } from "@/app/actions";

/**
 * POST /api/cleanup/expired-sessions
 *
 * Cron job endpoint to delete expired unclaimed sessions.
 * Protected by CRON_SECRET environment variable.
 *
 * Expected to be called daily by Vercel Cron.
 */
export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deletedCount, error } = await deleteExpiredSessions();

  if (error) {
    console.error("Failed to delete expired sessions:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  console.log(`Cleanup completed: deleted ${deletedCount} expired sessions`);

  return NextResponse.json({
    success: true,
    deletedCount,
    timestamp: new Date().toISOString(),
  });
}

// Also support GET for manual testing (with same auth)
export async function GET(req: Request) {
  return POST(req);
}
