"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Check, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRODUCT_IDS } from "@/lib/polar/types";

interface PricingTier {
  name: string;
  tier: "free" | "pro" | "team";
  price: string;
  description: string;
  features: string[];
  productId?: string;
  popular?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    tier: "free",
    price: "$0",
    description: "Perfect for trying out Pawboard",
    features: [
      "Up to 3 active boards",
      "Real-time collaboration",
      "Basic card features",
      "7-day board retention",
    ],
  },
  {
    name: "Pro",
    tier: "pro",
    price: "$9",
    description: "For power users and small teams",
    features: [
      "Unlimited boards",
      "Unlimited cards",
      "Advanced AI features",
      "Priority support",
      "30-day board history",
      "Custom themes",
    ],
    productId: PRODUCT_IDS.pro,
    popular: true,
  },
  {
    name: "Team",
    tier: "team",
    price: "$29",
    description: "For growing teams and organizations",
    features: [
      "Everything in Pro",
      "Team workspaces",
      "Advanced permissions",
      "SSO integration",
      "90-day board history",
      "Dedicated support",
    ],
    productId: PRODUCT_IDS.team,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (productId: string, tier: string) => {
    setLoading(tier);

    try {
      const response = await fetch("/api/polar/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId, tier }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">
            Start for free, upgrade when you need more
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.tier}
              className={tier.popular ? "border-primary shadow-lg" : ""}
            >
              {tier.popular && (
                <div className="bg-primary text-primary-foreground text-center py-2 font-semibold rounded-t-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {tier.name}
                  {tier.popular && <Zap className="h-5 w-5 text-primary" />}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.tier !== "free" && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {tier.tier === "free" ? (
                  <Button asChild className="w-full">
                    <Link href="/">Get Started</Link>
                  </Button>
                ) : (
                  <>
                    <SignedIn>
                      <Button
                        className="w-full"
                        onClick={() =>
                          handleCheckout(tier.productId!, tier.tier)
                        }
                        disabled={loading === tier.tier}
                      >
                        {loading === tier.tier ? "Loading..." : "Subscribe"}
                      </Button>
                    </SignedIn>
                    <SignedOut>
                      <SignInButton mode="modal">
                        <Button className="w-full">Sign In to Subscribe</Button>
                      </SignInButton>
                    </SignedOut>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            All plans include SSL encryption, regular backups, and access to our
            community.
          </p>
        </div>
      </div>
    </div>
  );
}
