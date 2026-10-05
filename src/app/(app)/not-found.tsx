import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <SearchX className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This item doesn&apos;t exist, was deleted, or you don&apos;t have access to it.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
