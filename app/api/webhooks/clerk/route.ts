import type { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";

/**
 * Webhook handler for Clerk events.
 *
 * With the authentication paradigm shift, Clerk users are no longer stored
 * in our local database. Usernames are fetched directly from Clerk API.
 *
 * This webhook exists to acknowledge events and prevent Clerk from reporting
 * webhook failures, but no action is taken on the events.
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    // If no webhook secret is configured, just acknowledge
    // This allows the app to work without webhook configuration
    return new Response("OK", { status: 200 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.text();

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Log the event for debugging but don't take action
  // Clerk users are not stored locally - usernames are fetched from Clerk API
  console.log(`Received Clerk webhook: ${evt.type}`);

  return new Response("OK", { status: 200 });
}
