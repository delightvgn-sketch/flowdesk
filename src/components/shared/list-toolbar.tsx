"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Filters live in the URL (?q=&status=&sort=&page=) so lists are shareable,
 * survive refreshes and are rendered on the server.
 */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(updates: Record<string, string | null>, { resetPage = true } = {}) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return { params, set, pending };
}

export function SearchInput({ placeholder, className }: { placeholder: string; className?: string }) {
  const { params, set, pending } = useQueryState();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => set({ q: next.trim() || null }), 300);
        }}
        className="pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {pending ? (
        <Loader2 aria-label="Loading" className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" />
      ) : (
        value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              set({ q: null });
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-subtle-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
    </div>
  );
}

export function FilterSelect({
  param,
  label,
  options,
  allLabel = "All",
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const { params, set } = useQueryState();
  const value = params.get(param) ?? "all";
  return (
    <Select value={value} onValueChange={(v) => set({ [param]: v })}>
      <SelectTrigger aria-label={label} className={cn("w-full sm:w-auto sm:min-w-36", className)}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const { params, set } = useQueryState();
  const active = keys.some((k) => params.get(k));
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X /> Clear
    </Button>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}
