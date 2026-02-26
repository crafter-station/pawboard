import { MessageSquarePlus } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

const FEATUREBASE_URL = process.env.NEXT_PUBLIC_FEATUREBASE_ORG
  ? `https://${process.env.NEXT_PUBLIC_FEATUREBASE_ORG}.featurebase.app`
  : null;

type FeedbackButtonProps = Omit<ComponentProps<typeof Button>, "asChild">;

export function FeedbackButton(props: FeedbackButtonProps) {
  if (!FEATUREBASE_URL) return null;

  return (
    <Button variant="ghost" size="sm" asChild {...props}>
      <a href={FEATUREBASE_URL} target="_blank" rel="noopener noreferrer">
        <MessageSquarePlus className="mr-2 h-4 w-4" />
        Feedback
      </a>
    </Button>
  );
}
