import { Polar } from "@polar-sh/sdk";

// Initialize Polar client
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
});

// Polar configuration
export const POLAR_CONFIG = {
  organizationId: process.env.NEXT_PUBLIC_POLAR_ORGANIZATION_ID || "",
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET || "",
} as const;
