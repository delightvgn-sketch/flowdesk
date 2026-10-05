"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { AvatarStack, UserAvatar } from "./user-avatar";

export type Person = { id: string; fullName: string; avatarUrl?: string | null; title?: string | null };

/** Searchable multi-select for choosing teammates. */
export function PeoplePicker({
  people,
  value,
  onChange,
  id,
  placeholder = "Choose people…",
  ...aria
}: {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = people.filter((p) => value.includes(p.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...aria}
        >
          {selected.length ? (
            <>
              <AvatarStack people={selected.map((p) => ({ ...p, avatarUrl: p.avatarUrl ?? null }))} max={4} />
              <span className="truncate text-muted-foreground">
                {selected.length === 1 ? selected[0].fullName : `${selected.length} people`}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 text-subtle-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {people.map((p) => {
                const checked = value.includes(p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={p.fullName}
                    onSelect={() => onChange(checked ? value.filter((v) => v !== p.id) : [...value, p.id])}
                    aria-selected={checked}
                  >
                    <UserAvatar name={p.fullName} src={p.avatarUrl} size="sm" />
                    <span className="flex-1 truncate">
                      {p.fullName}
                      {p.title && <span className="ml-1.5 text-xs text-muted-foreground">{p.title}</span>}
                    </span>
                    <Check className={cn("size-4 text-primary", checked ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
