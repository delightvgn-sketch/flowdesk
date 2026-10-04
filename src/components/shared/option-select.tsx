"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

/** Select over {id,label} options with an optional "none" choice mapped to null. */
export function OptionSelect({
  options,
  value,
  onChange,
  noneLabel,
  placeholder = "Select…",
  id,
  disabled,
  ...aria
}: {
  options: { id: string; label: string }[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  noneLabel?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <Select value={value ?? (noneLabel ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full" {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EnumSelect<T extends string>({
  values,
  labels,
  value,
  onChange,
  id,
  ...aria
}: {
  values: readonly T[];
  labels: Record<T, { label: string }>;
  value: T;
  onChange: (value: T) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className="w-full" {...aria}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((v) => (
          <SelectItem key={v} value={v}>
            {labels[v].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
