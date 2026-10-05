"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Shared body for route error boundaries. Never shows raw error details. */
export function ErrorState({
  error,
  reset,
  homeHref = "/dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn&apos;t load this page. It&apos;s probably temporary — try again, and if it keeps happening, head back and retry
        in a moment.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-subtle-foreground">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href={homeHref}>Go back</Link>
        </Button>
      </div>
    </div>
  );
}
