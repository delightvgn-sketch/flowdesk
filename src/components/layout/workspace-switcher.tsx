"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspace } from "@/features/workspace/actions";
import { useAction } from "@/hooks/use-action";
import { ROLE_META } from "@/lib/constants";
import { initials } from "@/lib/utils";

import type { ShellWorkspace } from "./app-shell";

export function WorkspaceSwitcher({ current, workspaces }: { current: ShellWorkspace; workspaces: ShellWorkspace[] }) {
  const router = useRouter();
  const { execute, pending } = useAction(switchWorkspace, {
    onSuccess: ({ role }) => router.push(role === "CLIENT" ? "/portal" : "/dashboard"),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2 py-1.5 text-left shadow-xs transition-colors hover:border-border-strong disabled:opacity-60"
        disabled={pending}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[11px] font-semibold text-brand-strong">
          {initials(current.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{current.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {ROLE_META[current.role].label}
            {current.isDemo && " · Demo"}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 text-subtle-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onSelect={() => ws.id !== current.id && execute({ workspaceId: ws.id })}
            className="gap-2"
          >
            <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">{initials(ws.name)}</span>
            <span className="flex-1 truncate">{ws.name}</span>
            {ws.role === "CLIENT" && <Badge tone="warning">Portal</Badge>}
            {ws.id === current.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1">
            <Plus /> Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
