/**
 * Distributed rate limiter using Upstash Redis.
 *
 * Works correctly on Vercel serverless and edge functions.
 * Falls back to allowing all requests if Upstash is not configured.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

/**
 * Create rate limiter instance.
 * Returns null if Upstash credentials are not configured.
 */
function createRateLimiter(
  limiter: ReturnType<typeof Ratelimit.slidingWindow>,
  prefix: string,
) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  return new Ratelimit({
    redis,
    limiter,
    prefix: `pawboard:ratelimit:${prefix}`,
    analytics: true,
  });
}

// Rate limiters for different endpoint types
const rateLimiters = {
  /** AI endpoints - expensive operations (10 requests per minute) */
  ai: createRateLimiter(Ratelimit.slidingWindow(10, "1 m"), "ai"),
  /** Standard API endpoints (60 requests per minute) */
  standard: createRateLimiter(Ratelimit.slidingWindow(60, "1 m"), "standard"),
  /** Strict rate limit for sensitive operations (5 requests per minute) */
  strict: createRateLimiter(Ratelimit.slidingWindow(5, "1 m"), "strict"),
};

export type RateLimitType = keyof typeof rateLimiters;

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier for the client (e.g., IP address or user ID)
 * @param type - Type of rate limit to apply
 * @returns Object with success status and metadata
 */
export async function rateLimit(
  identifier: string,
  type: RateLimitType = "standard",
): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}> {
  const limiter = rateLimiters[type];

  // If Upstash is not configured, allow all requests
  if (!limiter) {
    return {
      success: true,
      remaining: 999,
      reset: Date.now() + 60_000,
      limit: 999,
    };
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: result.limit,
  };
}

/**
 * Get client identifier from request headers.
 * Uses X-Forwarded-For header (set by Vercel) or falls back to a default.
 */
export function getClientIdentifier(request: Request): string {
  // Vercel sets x-forwarded-for with the client IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return ip;
}

/**
 * Create a rate limit response with appropriate headers.
 */
export function rateLimitResponse(
  reset: number,
  limit: number,
  remaining: number,
): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(reset),
      },
    },
  );
}

// Re-export rate limit types for convenience
export const RATE_LIMITS = {
  ai: "ai",
  standard: "standard",
  strict: "strict",
} as const;
