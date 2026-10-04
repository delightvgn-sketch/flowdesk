"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Consistent modal layout for create/edit forms: fixed header, scrollable body,
 * sticky footer. Radix handles focus trapping, Escape and focus restoration.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg", className)}>
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FormDialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid flex-1 gap-4 overflow-y-auto px-5 py-5", className)}>{children}</div>;
}

export function FormDialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 border-t bg-muted/40 px-5 py-3 sm:flex-row sm:justify-end">{children}</div>;
}
