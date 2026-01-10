import { Webhooks } from "@polar-sh/nextjs";
import { db } from "@/db";
import { workspaces, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

async function updateWorkspaceTier(
  clerkUserId: string,
  tier: "free" | "pro",
  polarCustomerId?: string,
  polarSubscriptionId?: string
) {
  await db
    .update(workspaces)
    .set({
      tier,
      ...(polarCustomerId && { polarCustomerId }),
      ...(polarSubscriptionId && { polarSubscriptionId }),
    })
    .where(eq(workspaces.ownerId, clerkUserId));
}

async function upgradeSingleBoard(sessionId: string) {
  await db
    .update(sessions)
    .set({ isPro: true })
    .where(eq(sessions.id, sessionId));
}

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const externalId = payload.data.customer.externalId;
    if (!externalId) return;

    await updateWorkspaceTier(
      externalId,
      "pro",
      payload.data.customerId,
      payload.data.id
    );
  },

  onSubscriptionActive: async (payload) => {
    const externalId = payload.data.customer.externalId;
    if (!externalId) return;

    await updateWorkspaceTier(
      externalId,
      "pro",
      payload.data.customerId,
      payload.data.id
    );
  },

  onSubscriptionCanceled: async (payload) => {
    const externalId = payload.data.customer.externalId;
    if (!externalId) return;

    await updateWorkspaceTier(externalId, "free");
  },

  onSubscriptionRevoked: async (payload) => {
    const externalId = payload.data.customer.externalId;
    if (!externalId) return;

    await updateWorkspaceTier(externalId, "free");
  },

  onOrderPaid: async (payload) => {
    const metadata = payload.data.metadata as Record<string, string> | null;
    if (metadata?.type === "single_board" && metadata.boardId) {
      await upgradeSingleBoard(metadata.boardId);
    }
  },
});
