"use client";

import { useRouter } from "next/navigation";

import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { Input } from "@/components/ui/input";
import { createWorkspace } from "@/features/onboarding/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { onboardingSchema } from "@/lib/validation";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const form = useZodForm(onboardingSchema, { workspaceName: "", fullName: defaultName });
  const { execute, pending } = useAction(createWorkspace, {
    success: "Workspace created. Welcome aboard!",
    onSuccess: () => router.push("/dashboard"),
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });

  return (
    <form onSubmit={form.handleSubmit((v) => execute(v))} className="mt-8 grid gap-5 rounded-xl border bg-card p-5 shadow-xs sm:p-6" noValidate>
      <FormField
        control={form.control}
        name="workspaceName"
        label="Workspace name"
        description="Usually your studio, agency or business name."
        required
        render={({ field, props }) => <Input {...field} {...props} placeholder="e.g. Mwangaza Studio" autoFocus />}
      />
      <FormField
        control={form.control}
        name="fullName"
        label="Your name"
        required
        render={({ field, props }) => <Input {...field} {...props} autoComplete="name" />}
      />
      <SubmitButton pending={pending} pendingLabel="Creating workspace…" className="w-full">
        Create workspace
      </SubmitButton>
    </form>
  );
}
