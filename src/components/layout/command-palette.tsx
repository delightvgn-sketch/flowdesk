"use client";

import { CheckSquare, FileText, FolderKanban, Loader2, Paperclip, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { searchWorkspace, type SearchResult } from "@/features/search/actions";
import { can } from "@/lib/permissions";
import type { WorkspaceRole } from "@/server/db/schema";

import type { NavGroup } from "./nav";

const TYPE_META: Record<SearchResult["type"], { label: string; icon: typeof Users }> = {
  client: { label: "Clients", icon: Users },
  project: { label: "Projects", icon: FolderKanban },
  task: { label: "Tasks", icon: CheckSquare },
  invoice: { label: "Invoices", icon: FileText },
  file: { label: "Files", icon: Paperclip },
};

export function CommandPalette({
  open,
  onOpenChange,
  groups,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroup[];
  role: WorkspaceRole;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const latest = useRef("");

  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (!q) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchWorkspace({ q });
        if (latest.current === q && res.ok) setResults(res.data);
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const grouped = Object.entries(TYPE_META)
    .map(([type, meta]) => ({ type, meta, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  const quickActions = [
    can(role, "client:manage") && { label: "New client", href: "/clients?new=1" },
    can(role, "project:create") && { label: "New project", href: "/projects?new=1" },
    can(role, "task:create") && { label: "New task", href: "/tasks?new=1" },
    can(role, "invoice:manage") && { label: "New invoice", href: "/invoices/new" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search FlowDesk"
      description="Search clients, projects, tasks, invoices and files"
      shouldFilter={false}
    >
      <CommandInput placeholder="Search FlowDesk…" value={query} onValueChange={setQuery} />
      <CommandList>
        {query.trim() ? (
          <>
            {pending && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>No results for “{query.trim()}”.</CommandEmpty>
            )}
            {grouped.map(({ type, meta, items }) => (
              <CommandGroup key={type} heading={meta.label}>
                {items.map((r) => (
                  <CommandItem key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)}>
                    <meta.icon className="text-subtle-foreground" />
                    <span className="truncate">{r.title}</span>
                    {r.subtitle && <span className="ml-auto truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        ) : (
          <>
            {quickActions.length > 0 && (
              <CommandGroup heading="Create">
                {quickActions.map((a) => (
                  <CommandItem key={a.href} value={a.label} onSelect={() => go(a.href)}>
                    <Plus className="text-subtle-foreground" />
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="Go to">
              {groups
                .flatMap((g) => g.items)
                .map((item) => (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                    <item.icon className="text-subtle-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
