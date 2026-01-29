/**
 * Simple in-memory rate limiter for API routes.
 *
 * Note: This is suitable for single-instance deployments.
 * For production with multiple instances, use Upstash Ratelimit or similar.
 */

interface RateLimitOptions {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier for the client (e.g., IP address or user ID)
 * @param options - Rate limit configuration
 * @returns Object with success status and remaining requests
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions,
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const key = identifier;

  let entry = rateLimitStore.get(key);

  // Create new entry if none exists or window has expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + options.windowMs,
    };
  }

  // Check if rate limit exceeded
  if (entry.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: options.limit - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client identifier from request headers.
 * Uses X-Forwarded-For header or falls back to a default.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return ip;
}

/**
 * Create a rate limit response with appropriate headers.
 */
export function rateLimitResponse(reset: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Reset": String(reset),
      },
    },
  );
}

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  /** AI endpoints - expensive operations (10 requests per minute) */
  ai: { limit: 10, windowMs: 60_000 },
  /** Standard API endpoints (60 requests per minute) */
  standard: { limit: 60, windowMs: 60_000 },
  /** Strict rate limit for sensitive operations (5 requests per minute) */
  strict: { limit: 5, windowMs: 60_000 },
} as const;
