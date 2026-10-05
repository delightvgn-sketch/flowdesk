"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { EnumSelect, OptionSelect } from "@/components/shared/option-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createEvent } from "@/features/calendar/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { EVENT_TYPES, EVENT_TYPE_META } from "@/lib/constants";
import { eventSchema } from "@/lib/validation";

export function NewEventButton({ defaultDate, projects }: { defaultDate: string; projects: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty = { title: "", description: "", type: "MEETING" as const, date: defaultDate, startTime: "10:00", endTime: "11:00", allDay: false, location: "", projectId: null, clientId: null };
  const form = useZodForm(eventSchema, empty);
  const allDay = form.watch("allDay");
  useEffect(() => {
    if (open) form.reset(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);
  const { execute, pending } = useAction(createEvent, {
    success: "Event added to the calendar.",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New event
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="New event">
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((v) => execute(v))}>
          <FormDialogBody>
            <FormField control={form.control} name="title" label="Title" required render={({ field, props }) => <Input {...field} {...props} placeholder="Client kickoff call" autoFocus />} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="type" label="Type" render={({ field, props }) => <EnumSelect {...props} values={EVENT_TYPES} labels={EVENT_TYPE_META} value={field.value} onChange={field.onChange} />} />
              <FormField control={form.control} name="date" label="Date" required render={({ field, props }) => <Input {...field} {...props} type="date" />} />
              {!allDay && (
                <>
                  <FormField control={form.control} name="startTime" label="Starts" required render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="time" />} />
                  <FormField control={form.control} name="endTime" label="Ends" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} type="time" />} />
                </>
              )}
            </div>
            <FormField
              control={form.control}
              name="allDay"
              label="Duration"
              render={({ field, props }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox id={props.id} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} /> All-day
                </label>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="location" label="Location" render={({ field, props }) => <Input {...field} value={field.value ?? ""} {...props} placeholder="Google Meet, office…" />} />
              <FormField control={form.control} name="projectId" label="Project" render={({ field, props }) => <OptionSelect {...props} options={projects} value={field.value} onChange={field.onChange} noneLabel="None" />} />
            </div>
            <FormField control={form.control} name="description" label="Notes" render={({ field, props }) => <Textarea {...field} value={field.value ?? ""} {...props} rows={2} />} />
          </FormDialogBody>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending}>Add event</SubmitButton>
          </FormDialogFooter>
        </form>
      </FormDialog>
    </>
  );
}
