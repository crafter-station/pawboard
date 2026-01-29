import { z } from "zod";

/**
 * Environment variable validation schemas.
 *
 * This file validates required environment variables at runtime,
 * providing clear error messages when variables are missing.
 */

// Server-side environment variables
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GROQ_API_KEY: z.string().optional(),
  INTERNAL_API_SECRET: z.string().optional(),
});

// Client-side environment variables (NEXT_PUBLIC_*)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: z
    .string()
    .min(1, "Supabase anon key is required"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

/**
 * Validate and return server environment variables.
 * Throws an error if validation fails.
 */
export function getServerEnv() {
  const result = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Server environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Validate and return client environment variables.
 * Throws an error if validation fails.
 */
export function getClientEnv() {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Client environment validation failed:\n${errors}`);
  }

  return result.data;
}

// Type exports
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
