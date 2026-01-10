import { CheckCircleIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircleIcon className="h-8 w-8 text-green-500" />
        </div>

        <h1 className="mb-2 text-2xl font-bold">Welcome to Pawboard Pro!</h1>

        <p className="mb-8 text-muted-foreground">
          Your upgrade was successful. You now have unlimited access to all Pro
          features. Time to supercharge your brainstorming!
        </p>

        <div className="space-y-3">
          <Button asChild className="w-full gap-2">
            <Link href="/">
              Start brainstorming
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/api/polar/portal">Manage subscription</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
