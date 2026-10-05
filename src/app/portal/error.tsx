"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} homeHref="/portal" />;
}
