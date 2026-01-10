import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { PricingTable } from "@/components/billing";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col p-8">
      <div className="mb-8 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            New session
          </Link>
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-2xl">
          <h1 className="mb-2 text-center text-3xl font-bold">Pricing</h1>
          <p className="mb-8 text-center text-muted-foreground">
            Simple pricing for teams that ship
          </p>
          <PricingTable />
        </div>
      </div>
    </div>
  );
}
