import { validateEvent } from "@polar-sh/sdk/webhooks";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, subscriptions } from "@/db/schema";
import { POLAR_CONFIG } from "@/lib/polar";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("webhook-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing webhook signature" },
        { status: 401 },
      );
    }

    // Validate the webhook signature
    const event = validateEvent(body, signature, POLAR_CONFIG.webhookSecret);

    // Handle different event types
    switch (event.type) {
      case "subscription.created":
      case "subscription.updated": {
        const subscription = event.data;
        await db
          .insert(subscriptions)
          .values({
            id: subscription.id,
            userId: subscription.metadata?.userId || "",
            polarCustomerId: subscription.customer_id,
            productId: subscription.product_id,
            tier: subscription.metadata?.tier || "pro",
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start
              ? new Date(subscription.current_period_start)
              : null,
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end)
              : null,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: subscriptions.id,
            set: {
              status: subscription.status,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start)
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end)
                : null,
              cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              updatedAt: new Date(),
            },
          });
        break;
      }

      case "subscription.canceled": {
        const subscription = event.data;
        await db
          .insert(subscriptions)
          .values({
            id: subscription.id,
            userId: subscription.metadata?.userId || "",
            polarCustomerId: subscription.customer_id,
            productId: subscription.product_id,
            tier: subscription.metadata?.tier || "pro",
            status: "canceled",
            currentPeriodStart: subscription.current_period_start
              ? new Date(subscription.current_period_start)
              : null,
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end)
              : null,
            cancelAtPeriodEnd: true,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: subscriptions.id,
            set: {
              status: "canceled",
              cancelAtPeriodEnd: true,
              updatedAt: new Date(),
            },
          });
        break;
      }

      case "order.created": {
        const order = event.data;
        await db.insert(orders).values({
          id: order.id,
          userId: order.metadata?.userId || "",
          polarCustomerId: order.customer_id,
          productId: order.product_id,
          amount: order.amount,
          currency: order.currency,
          status: "succeeded",
          createdAt: new Date(),
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 },
    );
  }
}
