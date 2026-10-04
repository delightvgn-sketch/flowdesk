import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Small status/metadata label. Use `tone` for semantic meaning — every status
 * in the app maps to a tone in `lib/constants.ts`, never to a raw colour.
 */
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-1.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-secondary text-secondary-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        brand: "border-transparent bg-brand-soft text-brand-strong",
        info: "border-transparent bg-info-soft text-info",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning dark:text-warning",
        danger: "border-transparent bg-danger-soft text-danger",
        outline: "border-border bg-transparent text-foreground",
      },
      dot: { true: "pl-1.5", false: "" },
    },
    defaultVariants: { tone: "neutral", dot: false },
  }
)

const dotColor: Record<string, string> = {
  neutral: "bg-subtle-foreground",
  muted: "bg-subtle-foreground",
  brand: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  outline: "bg-foreground",
}

function Badge({
  className,
  tone = "neutral",
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ tone, dot }), className)} {...props}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dotColor[tone ?? "neutral"])} />}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
