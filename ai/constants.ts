// AI model configuration
export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export const SUPPORTED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
