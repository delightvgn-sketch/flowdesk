"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Dialog state that can also be opened from the URL (`?new=1`, used by the
 * ⌘K "Create" shortcuts). Open state is derived, not synced in an effect.
 */
export function useQueryDialog(key = "new", extraKeys: string[] = []) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [localOpen, setLocalOpen] = useState(false);
  const fromQuery = params.get(key) === "1";

  function setOpen(open: boolean) {
    setLocalOpen(open);
    if (!open && fromQuery) {
      const next = new URLSearchParams(params.toString());
      for (const k of [key, ...extraKeys]) next.delete(k);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  return { open: localOpen || fromQuery, setOpen, fromQuery, params };
}
