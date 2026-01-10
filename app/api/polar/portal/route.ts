import { CustomerPortal } from "@polar-sh/nextjs";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

async function getWorkspacePolarCustomerId(
  userId: string | null
): Promise<string> {
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, userId),
  });

  if (!workspace?.polarCustomerId) {
    throw new Error("No Polar customer found for this user");
  }

  return workspace.polarCustomerId;
}

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  getCustomerId: async () => {
    const { userId } = await auth();
    return getWorkspacePolarCustomerId(userId);
  },
  server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});
