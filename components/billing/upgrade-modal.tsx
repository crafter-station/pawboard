"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { CheckIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIER_LIMITS } from "@/lib/feature-gates";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  currentUsage?: number;
  limit?: number;
}

const PRO_FEATURES = [
  "Unlimited AI insights per board",
  "Unlimited workspaces",
  "Export boards to PDF/PNG",
  "Board history & versioning",
  "Auto-generated summaries",
  "Priority support",
];

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  currentUsage,
  limit,
}: UpgradeModalProps) {
  const { isSignedIn } = useUser();

  const handleUpgrade = (yearly = false) => {
    const productId = yearly
      ? process.env.NEXT_PUBLIC_POLAR_PRO_YEARLY_ID
      : process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID;
    window.location.href = `/api/polar/checkout?products=${productId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
            <SparklesIcon className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center text-xl">
            Unlock Pawboard Pro
          </DialogTitle>
          <DialogDescription className="text-center">
            {feature && currentUsage !== undefined && limit !== undefined ? (
              <>
                You&apos;ve used {currentUsage}/{limit} {feature}. Upgrade to
                Pro for unlimited access.
              </>
            ) : (
              <>
                Get unlimited access to all features and supercharge your
                brainstorming sessions.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {PRO_FEATURES.map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <CheckIcon className="h-3 w-3 text-green-500" />
              </div>
              <span className="text-sm">{feat}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold">$10</div>
            <div className="text-xs text-muted-foreground">/month</div>
          </div>
          <div className="rounded-lg border border-primary bg-primary/5 p-3 text-center">
            <div className="text-lg font-bold">$96</div>
            <div className="text-xs text-muted-foreground">/year (save 20%)</div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isSignedIn ? (
            <>
              <Button onClick={() => handleUpgrade(true)} className="w-full gap-2">
                <ZapIcon className="h-4 w-4" />
                Get Pro Yearly (Best value)
              </Button>
              <Button onClick={() => handleUpgrade(false)} variant="outline" className="w-full gap-2">
                Get Pro Monthly
              </Button>
            </>
          ) : (
            <SignInButton mode="modal">
              <Button className="w-full gap-2">
                <ZapIcon className="h-4 w-4" />
                Sign in to upgrade
              </Button>
            </SignInButton>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
