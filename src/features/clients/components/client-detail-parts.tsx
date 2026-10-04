"use client";

import { Loader2, Plus, Sparkles, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Markdown } from "@/components/shared/markdown";
import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { summarizeClient } from "@/features/ai/actions";
import { addContact, deleteContact } from "@/features/clients/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { clientContactSchema } from "@/lib/validation";

type Contact = { id: string; name: string; email: string | null; phone: string | null; jobTitle: string | null; isPrimary: boolean };

export function ContactsList({ clientId, contacts, canManage }: { clientId: string; contacts: Contact[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useZodForm(clientContactSchema, { clientId, name: "", email: "", phone: "", jobTitle: "" });
  const add = useAction(addContact, {
    success: "Contact added.",
    onSuccess: () => {
      setOpen(false);
      form.reset({ clientId, name: "", email: "", phone: "", jobTitle: "" });
      router.refresh();
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });
  const remove = useAction(deleteContact, { success: "Contact removed.", onSuccess: () => router.refresh() });

  return (
    <div>
      <ul className="divide-y">
        {contacts.map((c) => (
          <li key={c.id} className="group flex items-center gap-3 py-2.5">
            <UserAvatar name={c.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {c.name}
                {c.isPrimary && <Badge tone="brand">Primary</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(" · ") || "No details"}</p>
            </div>
            {canManage && !c.isPrimary && (
              <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Remove ${c.name}`} onClick={() => remove.execute({ id: c.id })}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(true)}>
          <UserPlus /> Add contact
        </Button>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title="Add contact" className="sm:max-w-md">
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((v) => add.execute(v))}>
          <FormDialogBody>
            <FormField control={form.control} name="name" label="Name" required render={({ field, props }) => <Input {...field} {...props} autoFocus />} />
            <FormField control={form.control} name="jobTitle" label="Job title" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} />} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="email" label="Email" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="email" />} />
              <FormField control={form.control} name="phone" label="Phone" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="tel" />} />
            </div>
          </FormDialogBody>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={add.pending}>
              <Plus /> Add contact
            </SubmitButton>
          </FormDialogFooter>
        </form>
      </FormDialog>
    </div>
  );
}

/** One-click AI briefing on a client, generated from live workspace data. */
export function ClientAiSummary({ clientId }: { clientId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const { execute, pending } = useAction(summarizeClient, { onSuccess: ({ text }) => setSummary(text) });

  return (
    <div>
      {summary ? (
        <div>
          <Markdown>{summary}</Markdown>
          <Button variant="ghost" size="xs" className="mt-2" onClick={() => execute({ id: clientId })} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Regenerate
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Get a briefing on this client: relationship, work in flight, money owed and what needs attention.</p>
          <Button variant="outline" size="sm" onClick={() => execute({ id: clientId })} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Thinking…" : "Summarize"}
          </Button>
        </div>
      )}
    </div>
  );
}
