import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

const PALETTE = [
  "bg-[oklch(0.9_0.05_178)] text-[oklch(0.35_0.07_178)] dark:bg-[oklch(0.32_0.05_178)] dark:text-[oklch(0.88_0.06_178)]",
  "bg-[oklch(0.91_0.05_75)] text-[oklch(0.4_0.08_60)] dark:bg-[oklch(0.33_0.05_75)] dark:text-[oklch(0.9_0.07_80)]",
  "bg-[oklch(0.91_0.04_255)] text-[oklch(0.38_0.1_255)] dark:bg-[oklch(0.32_0.05_255)] dark:text-[oklch(0.88_0.06_255)]",
  "bg-[oklch(0.91_0.04_25)] text-[oklch(0.42_0.12_25)] dark:bg-[oklch(0.33_0.06_25)] dark:text-[oklch(0.88_0.06_25)]",
  "bg-[oklch(0.91_0.04_320)] text-[oklch(0.4_0.1_320)] dark:bg-[oklch(0.32_0.05_320)] dark:text-[oklch(0.88_0.06_320)]",
  "bg-[oklch(0.92_0.04_140)] text-[oklch(0.38_0.09_145)] dark:bg-[oklch(0.32_0.05_145)] dark:text-[oklch(0.88_0.06_145)]",
];

function colorFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function UserAvatar({
  name,
  src,
  size = "default",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const label = name ?? "Unknown";
  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback role="img" className={cn("font-medium", colorFor(label))} aria-label={label} title={label}>
        <span aria-hidden className={size === "sm" ? "text-[10px]" : "text-xs"}>
          {initials(label)}
        </span>
      </AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars with a "+N" overflow. */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
}: {
  people: { id: string; fullName: string; avatarUrl?: string | null }[];
  max?: number;
  size?: "sm" | "default";
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  if (people.length === 0) return <span className="text-xs text-muted-foreground">No one yet</span>;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <UserAvatar key={p.id} name={p.fullName} src={p.avatarUrl} size={size} className="ring-2 ring-card" />
      ))}
      {extra > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}
