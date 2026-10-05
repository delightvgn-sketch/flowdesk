import { cn } from "@/lib/utils";

/** FlowDesk wordmark: two offset strokes suggesting work flowing through a desk. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 11.5h9.5a4.5 4.5 0 0 1 0 9H15"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <path d="M9 16h5.5" fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-primary-foreground/70" />
      <path d="M9 20.5h2" fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-primary-foreground/45" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={compact ? "size-6" : undefined} />
      <span className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-[15px]")}>FlowDesk</span>
    </span>
  );
}
