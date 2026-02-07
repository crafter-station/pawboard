// Polar subscription tiers
export type SubscriptionTier = "free" | "pro" | "team";

// Polar product IDs (these would be actual product IDs from Polar)
export const PRODUCT_IDS = {
  pro: process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID || "",
  team: process.env.NEXT_PUBLIC_POLAR_TEAM_PRODUCT_ID || "",
} as const;
