import type { Session, Workspace, WorkspaceTier } from "@/db/schema";

export const TIER_LIMITS = {
  free: {
    workspaces: 1,
    seatsPerBoard: 50,
    aiInsightsPerBoard: 5,
    canExport: false,
    hasHistory: false,
    hasSummary: false,
  },
  pro: {
    workspaces: Infinity,
    seatsPerBoard: Infinity,
    aiInsightsPerBoard: Infinity,
    canExport: true,
    hasHistory: true,
    hasSummary: true,
  },
} as const satisfies Record<WorkspaceTier, Record<string, number | boolean>>;

export type TierFeature = keyof (typeof TIER_LIMITS)["free"];

export function getTierLimits(tier: WorkspaceTier) {
  return TIER_LIMITS[tier];
}

export function canUseFeature(
  tierOrWorkspace: WorkspaceTier | Workspace | null,
  feature: TierFeature
): boolean {
  if (!tierOrWorkspace) return TIER_LIMITS.free[feature] as boolean;

  const tier =
    typeof tierOrWorkspace === "string"
      ? tierOrWorkspace
      : tierOrWorkspace.tier;

  const value = TIER_LIMITS[tier][feature];
  return typeof value === "boolean" ? value : value > 0;
}

export function getFeatureLimit(
  tierOrWorkspace: WorkspaceTier | Workspace | null,
  feature: TierFeature
): number {
  if (!tierOrWorkspace)
    return TIER_LIMITS.free[feature] as number;

  const tier =
    typeof tierOrWorkspace === "string"
      ? tierOrWorkspace
      : tierOrWorkspace.tier;

  return TIER_LIMITS[tier][feature] as number;
}

export function isWithinLimit(
  tierOrWorkspace: WorkspaceTier | Workspace | null,
  feature: TierFeature,
  currentUsage: number
): boolean {
  const limit = getFeatureLimit(tierOrWorkspace, feature);
  if (limit === Infinity) return true;
  return currentUsage < limit;
}

export function getSessionTier(
  session: Session,
  workspace: Workspace | null
): WorkspaceTier {
  if (session.isPro) return "pro";
  if (workspace) return workspace.tier;
  return "free";
}

export function shouldShowUpgrade(
  tierOrWorkspace: WorkspaceTier | Workspace | null,
  feature: TierFeature,
  currentUsage?: number
): boolean {
  const tier =
    typeof tierOrWorkspace === "string"
      ? tierOrWorkspace
      : tierOrWorkspace?.tier ?? "free";

  if (tier === "pro") return false;

  if (currentUsage !== undefined) {
    const limit = getFeatureLimit(tier, feature);
    if (limit !== Infinity) {
      const threshold = Math.floor(limit * 0.8);
      return currentUsage >= threshold;
    }
  }

  return !canUseFeature(tier, feature);
}
