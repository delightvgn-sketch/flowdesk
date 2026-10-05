"use client";

import { UserProfile } from "@clerk/nextjs";
import { Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteWorkspace, updateNotificationPrefs, updateProfile, updateWorkspace } from "@/features/settings/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { TIMEZONES } from "@/lib/constants";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { cn } from "@/lib/utils";
import { profileSchema, workspaceSchema } from "@/lib/validation";
import type { NotificationPrefs } from "@/server/db/schema";

export function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-xs", className)}>
      <header className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const router = useRouter();
  const form = useZodForm(profileSchema, { fullName });
  const { execute, pending } = useAction(updateProfile, { success: "Profile saved.", onSuccess: () => router.refresh(), onError: (r) => applyFieldErrors(form, r.fieldErrors) });
  return (
    <form noValidate onSubmit={form.handleSubmit((v) => execute(v))} className="grid gap-4">
      <FormField control={form.control} name="fullName" label="Display name" required description="How teammates and clients see you in FlowDesk." render={({ field, props }) => <Input {...field} {...props} autoComplete="name" />} />
      <Field label="Email" description="Your sign-in email is managed in your account settings below.">
        {(p) => <Input {...p} value={email} readOnly disabled />}
      </Field>
      <div>
        <SubmitButton pending={pending} disabled={!form.formState.isDirty}>Save profile</SubmitButton>
      </div>
    </form>
  );
}

/** Clerk's hosted account management: email addresses, password, avatar, sessions. */
export function AccountManager() {
  return (
    <div className="overflow-x-auto [&_.cl-cardBox]:w-full [&_.cl-cardBox]:max-w-none [&_.cl-cardBox]:shadow-none [&_.cl-rootBox]:w-full">
      <UserProfile routing="hash" appearance={{ ...clerkAppearance, elements: { ...clerkAppearance.elements, card: { boxShadow: "none", border: "none" } } }} />
    </div>
  );
}

const PREF_LABELS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "taskAssigned", label: "Assignments", description: "When you're assigned a task or added to a project." },
  { key: "comments", label: "Comments & approvals", description: "Replies on tasks you're involved in and client approvals." },
  { key: "messages", label: "Messages", description: "New messages in your projects and client threads." },
  { key: "files", label: "Files", description: "When files are uploaded to your projects." },
  { key: "invoices", label: "Invoices", description: "Invoices sent, paid or overdue." },
  { key: "deadlines", label: "Deadlines & status", description: "Upcoming deadlines and project status changes." },
];

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const [value, setValue] = useState(prefs);
  const { execute } = useAction(updateNotificationPrefs, { success: "Notification preferences saved." });
  return (
    <ul className="divide-y">
      {PREF_LABELS.map((p) => (
        <li key={p.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <label htmlFor={`pref-${p.key}`} className="min-w-0">
            <span className="block text-sm font-medium">{p.label}</span>
            <span className="block text-xs text-muted-foreground">{p.description}</span>
          </label>
          <Switch
            id={`pref-${p.key}`}
            checked={value[p.key]}
            onCheckedChange={(checked) => {
              const next = { ...value, [p.key]: checked };
              setValue(next);
              execute(next);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn("flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors", active ? "border-primary bg-brand-soft/50 font-medium" : "hover:bg-muted")}
          >
            <o.icon className="size-5" aria-hidden /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

type WorkspaceValues = { name: string; email: string | null; phone: string | null; address: string | null; currency: string; timezone: string; invoicePrefix: string; defaultTaxRate: number };

export function WorkspaceForm({ workspace, readOnly }: { workspace: WorkspaceValues; readOnly: boolean }) {
  const router = useRouter();
  const form = useZodForm(workspaceSchema, { ...workspace, email: workspace.email ?? "", phone: workspace.phone ?? "", address: workspace.address ?? "" });
  const { execute, pending } = useAction(updateWorkspace, { success: "Workspace settings saved.", onSuccess: () => router.refresh(), onError: (r) => applyFieldErrors(form, r.fieldErrors) });

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => execute(v))} className="grid gap-4">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="name" label="Workspace name" required className="sm:col-span-2" render={({ field, props }) => <Input {...field} {...props} />} />
        <FormField control={form.control} name="email" label="Billing email" description="Shown on invoices." render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="email" />} />
        <FormField control={form.control} name="phone" label="Phone" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} />} />
        <FormField control={form.control} name="address" label="Address" className="sm:col-span-2" render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={3} />} />
        <FormField
          control={form.control}
          name="currency"
          label="Default currency"
          description="Used for new invoices."
          render={({ field, props }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
              <SelectTrigger {...props} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{SUPPORTED_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          )}
        />
        <FormField
          control={form.control}
          name="timezone"
          label="Timezone"
          description="Used for due dates and the calendar."
          render={({ field, props }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
              <SelectTrigger {...props} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          )}
        />
        <FormField control={form.control} name="invoicePrefix" label="Invoice prefix" description="e.g. INV → INV-0042" render={({ field, props }) => <Input {...field} {...props} onChange={(e) => field.onChange(e.target.value.toUpperCase())} maxLength={6} />} />
        <FormField control={form.control} name="defaultTaxRate" label="Default tax rate (%)" description="Kenya VAT is 16%." render={({ props }) => <Input {...props} type="number" step="any" min={0} max={100} {...form.register("defaultTaxRate")} />} />
      </fieldset>
      {!readOnly && (
        <div>
          <SubmitButton pending={pending}>Save workspace</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function DeleteWorkspace({ name, isDemo }: { name: string; isDemo: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const { execute, pending } = useAction(deleteWorkspace, {
    success: "Workspace deleted.",
    onSuccess: ({ remaining }) => {
      window.location.href = remaining > 0 ? "/dashboard" : "/onboarding";
    },
  });
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {isDemo ? "The shared demo workspace can't be deleted." : "Permanently delete this workspace and all of its clients, projects, invoices and files."}
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={isDemo}>
        Delete workspace
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name}?`}
        description={
          <span className="grid gap-3">
            This can&apos;t be undone. Type <strong>{name}</strong> to confirm.
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Workspace name" />
          </span>
        }
        confirmLabel="Delete forever"
        pending={pending}
        onConfirm={() => execute({ confirmName: confirm })}
      />
    </div>
  );
}
