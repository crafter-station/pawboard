"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: { name: string; included: boolean }[];
  cta: string;
  highlighted?: boolean;
  productId?: string;
}

const TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for trying out Pawboard",
    features: [
      { name: "1 workspace", included: true },
      { name: "50 participants per board", included: true },
      { name: "5 AI insights per board", included: true },
      { name: "Real-time collaboration", included: true },
      { name: "Export to PDF/PNG", included: false },
      { name: "Board history", included: false },
      { name: "Auto-generated summaries", included: false },
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$10",
    period: "/month",
    description: "For teams that ship ideas",
    features: [
      { name: "Unlimited workspaces", included: true },
      { name: "Unlimited participants", included: true },
      { name: "Unlimited AI insights", included: true },
      { name: "Real-time collaboration", included: true },
      { name: "Export to PDF/PNG", included: true },
      { name: "Board history", included: true },
      { name: "Auto-generated summaries", included: true },
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
    productId: process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID,
  },
];

export function PricingTable() {
  const { isSignedIn } = useUser();

  const handleUpgrade = (productId?: string) => {
    if (!productId) {
      window.location.href = "/";
      return;
    }
    window.location.href = `/api/polar/checkout?products=${productId}`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={cn(
            "relative rounded-xl border p-6",
            tier.highlighted &&
              "border-primary bg-gradient-to-b from-primary/5 to-transparent"
          )}
        >
          {tier.highlighted && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most popular
              </span>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-semibold">{tier.name}</h3>
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          </div>

          <div className="mb-6">
            <span className="text-3xl font-bold">{tier.price}</span>
            {tier.period && (
              <span className="text-muted-foreground">{tier.period}</span>
            )}
          </div>

          <ul className="mb-6 space-y-3">
            {tier.features.map((feature) => (
              <li key={feature.name} className="flex items-center gap-2">
                {feature.included ? (
                  <CheckIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <XIcon className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    !feature.included && "text-muted-foreground"
                  )}
                >
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>

          {tier.productId ? (
            isSignedIn ? (
              <Button
                onClick={() => handleUpgrade(tier.productId)}
                className="w-full"
                variant={tier.highlighted ? "default" : "outline"}
              >
                {tier.cta}
              </Button>
            ) : (
              <SignInButton mode="modal">
                <Button
                  className="w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                >
                  Sign in to upgrade
                </Button>
              </SignInButton>
            )
          ) : (
            <Button
              onClick={() => handleUpgrade()}
              className="w-full"
              variant="outline"
            >
              {tier.cta}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
