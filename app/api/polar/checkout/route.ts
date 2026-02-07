import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { polar } from "@/lib/polar";
import type { SubscriptionTier } from "@/lib/polar/types";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, tier } = body as {
      productId: string;
      tier: SubscriptionTier;
    };

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 },
      );
    }

    // Create a checkout session with Polar
    const checkoutSession = await polar.checkouts.custom.create({
      productId,
      metadata: {
        userId,
        tier,
      },
      successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing/success`,
      customerId: userId, // Use Clerk userId as customer ID
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
