"use client";

import { useId } from "react";
import { Controller, type Control, type ControllerRenderProps, type FieldPath, type FieldValues } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RenderProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

/**
 * Label + control + description + error, wired for accessibility: the error is
 * linked through aria-describedby and the control gets aria-invalid.
 */
export function Field({
  label,
  description,
  error,
  required,
  className,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: RenderProps) => React.ReactNode;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            *
          </span>
        )}
      </Label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {description && !error && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** `Field` bound to a react-hook-form controller. */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  className,
  render,
}: {
  control: Control<T>;
  name: N;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
  render: (args: {
    field: ControllerRenderProps<T, N>;
    props: RenderProps;
  }) => React.ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
          {(props) => render({ field, props })}
        </Field>
      )}
    />
  );
}
