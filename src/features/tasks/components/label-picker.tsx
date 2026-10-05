"use client";

import { Check, Plus, Tag } from "lucide-react";
import { useState } from "react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createLabel } from "@/features/tasks/actions";
import { useAction } from "@/hooks/use-action";
import { LABEL_COLORS } from "@/lib/constants";
import { labelClass } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

import type { TaskLabel } from "../types";

export function LabelChip({ label, className }: { label: TaskLabel; className?: string }) {
  return (
    <span
      className={cn("inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium", labelClass(label.color), className)}
    >
      {label.name}
    </span>
  );
}

/** Choose labels, or create a new one from the search text. */
export function LabelPicker({
  labels,
  value,
  onChange,
  onLabelCreated,
  id,
}: {
  labels: TaskLabel[];
  value: string[];
  onChange: (ids: string[]) => void;
  onLabelCreated?: (label: TaskLabel) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const create = useAction(createLabel, {
    success: (l) => `Label “${l.name}” created.`,
    onSuccess: (l) => {
      onLabelCreated?.(l);
      onChange([...value, l.id]);
      setSearch("");
    },
  });
  const selected = labels.filter((l) => value.includes(l.id));
  const exact = labels.some((l) => l.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1.5 text-left text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Labels"
        >
          {selected.length ? (
            selected.map((l) => <LabelChip key={l.id} label={l} />)
          ) : (
            <span className="flex items-center gap-1.5 px-1 text-muted-foreground">
              <Tag className="size-3.5" /> Add labels
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or create…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No labels.</CommandEmpty>
            <CommandGroup>
              {labels.map((l) => {
                const checked = value.includes(l.id);
                return (
                  <CommandItem
                    key={l.id}
                    value={l.name}
                    onSelect={() => onChange(checked ? value.filter((v) => v !== l.id) : [...value, l.id])}
                  >
                    <LabelChip label={l} />
                    <Check className={cn("ml-auto size-4 text-primary", checked ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
              {search.trim() && !exact && (
                <CommandItem
                  value={`create-${search}`}
                  disabled={create.pending}
                  onSelect={() =>
                    create.execute({ name: search.trim(), color: LABEL_COLORS[labels.length % LABEL_COLORS.length] })
                  }
                >
                  <Plus /> Create “{search.trim()}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
