"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "@/features/clients/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { CLIENT_STATUS_META, CLIENT_STATUSES } from "@/lib/constants";
import { clientSchema, type ClientInput } from "@/lib/validation";
import type { ClientStatus } from "@/server/db/schema";

export type ClientFormValues = {
  id?: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  tags: string[];
};

const EMPTY: ClientInput = { name: "", company: "", email: "", phone: "", website: "", address: "", notes: "", status: "LEAD", tags: [] };

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientFormValues;
}) {
  const router = useRouter();
  const editing = !!client?.id;
  const form = useZodForm(clientSchema, EMPTY);

  useEffect(() => {
    if (!open) return;
    form.reset(
      client
        ? {
            name: client.name,
            company: client.company ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            website: client.website ?? "",
            address: client.address ?? "",
            notes: client.notes ?? "",
            status: client.status,
            tags: client.tags,
          }
        : EMPTY,
    );
  }, [open, client, form]);

  const create = useAction(createClient, {
    success: "Client created successfully.",
    onSuccess: ({ id }) => {
      onOpenChange(false);
      router.push(`/clients/${id}`);
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });
  const update = useAction(updateClient, {
    success: "Client updated.",
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });
  const pending = create.pending || update.pending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit client" : "New client"}
      description={editing ? undefined : "Add a lead or customer to your CRM."}
    >
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => (editing ? update.execute({ ...values, id: client!.id! }) : create.execute(values)))}
      >
        <FormDialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="company" label="Company" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} placeholder="Northstar Digital" autoFocus />} />
            <FormField control={form.control} name="name" label="Contact name" required render={({ field, props }) => <Input {...field} {...props} placeholder="Grace Achieng" autoComplete="off" />} />
            <FormField control={form.control} name="email" label="Email" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="email" placeholder="grace@northstar.co.ke" />} />
            <FormField control={form.control} name="phone" label="Phone" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="tel" placeholder="+254 7xx xxx xxx" />} />
            <FormField control={form.control} name="website" label="Website" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} placeholder="northstar.co.ke" />} />
            <FormField
              control={form.control}
              name="status"
              label="Status"
              required
              render={({ field, props }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CLIENT_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <FormField control={form.control} name="address" label="Address" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} placeholder="Westlands, Nairobi" />} />
          <FormField
            control={form.control}
            name="tags"
            label="Tags"
            description="Press Enter or comma to add."
            render={({ field, props }) => <TagInput value={field.value ?? []} onChange={field.onChange} {...props} />}
          />
          <FormField control={form.control} name="notes" label="Notes" render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={3} placeholder="Context, preferences, history…" />} />
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton pending={pending} pendingLabel="Saving…">
            {editing ? "Save changes" : "Create client"}
          </SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
