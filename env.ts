import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables.
   * These are not available on the client.
   */
  server: {
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    GROQ_API_KEY: z.string().optional(),
    INTERNAL_API_SECRET: z.string().optional(),
  },

  /**
   * Client-side environment variables.
   * These are available on both client and server.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: z
      .string()
      .min(1, "Supabase anon key is required"),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },

  /**
   * Runtime environment variables.
   * Due to how Next.js bundles environment variables,
   * we need to manually destructure them here.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  /**
   * Skip validation in certain environments.
   * Useful for Docker builds where env vars aren't available.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR=` will be treated as if it was not set.
   */
  emptyStringAsUndefined: true,
});
