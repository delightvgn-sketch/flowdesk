"use client";

import { Calendar, Check, MessageSquare, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PriorityIndicator } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { moveTask } from "@/features/tasks/actions";
import { TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { dueLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { BoardTask } from "../types";
import { LabelChip } from "./label-picker";

export function TaskCard({ task, today, overlay = false }: { task: BoardTask; today: string; overlay?: boolean }) {
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;
  const done = task.status === "DONE";

  return (
    <article
      className={cn(
        "group relative cursor-grab rounded-lg border bg-card p-3 text-left shadow-xs transition-shadow hover:border-border-strong hover:shadow-sm active:cursor-grabbing",
        overlay && "rotate-1 shadow-lg ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start gap-2">
        <h3
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-snug font-medium",
            done && "text-muted-foreground line-through decoration-1",
          )}
        >
          {task.title}
        </h3>
        {!overlay && <MoveMenu task={task} />}
      </div>
      {task.projectName && <p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName}</p>}
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <PriorityIndicator value={task.priority} />
        {due && !done && (
          <span className={cn("inline-flex items-center gap-1", due.overdue && "font-medium text-danger")}>
            <Calendar className="size-3" aria-hidden />
            {due.text}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={`${task.commentCount} comments`}>
            <MessageSquare className="size-3" aria-hidden />
            {task.commentCount}
          </span>
        )}
        <span className="ml-auto">
          {task.assigneeName ? (
            <UserAvatar name={task.assigneeName} src={task.assigneeAvatar} size="sm" />
          ) : (
            <span className="text-subtle-foreground">Unassigned</span>
          )}
        </span>
      </div>
    </article>
  );
}

/** Accessible alternative to drag & drop. */
function MoveMenu({ task }: { task: BoardTask }) {
  const router = useRouter();
  async function move(status: (typeof TASK_STATUSES)[number]) {
    const result = await moveTask({ id: task.id, status });
    if (!result.ok) return toast.error(result.error);
    toast.success(status === "DONE" ? "Task completed." : `Moved to ${TASK_STATUS_META[status].label}.`);
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="-mt-1 -mr-1 rounded-md p-1 text-subtle-foreground opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`Move “${task.title}”`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Move to</DropdownMenuLabel>
        {TASK_STATUSES.map((s) => (
          <DropdownMenuItem key={s} disabled={s === task.status} onSelect={() => move(s)}>
            {s === task.status ? <Check /> : <span className="size-4" />}
            {TASK_STATUS_META[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
