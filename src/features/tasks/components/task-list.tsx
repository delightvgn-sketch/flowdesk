"use client";

import { CheckSquare } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PriorityIndicator, StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { dueLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { BoardTask } from "../types";
import { LabelChip } from "./label-picker";
import { openTask } from "./task-sheet";

/** Compact list view of tasks — an alternative to the board that works well on small screens. */
export function TaskList({ tasks, today }: { tasks: BoardTask[]; today: string }) {
  if (tasks.length === 0)
    return <EmptyState icon={CheckSquare} title="No tasks match" description="Try different filters, or create a task." />;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <ul className="divide-y">
        {tasks.map((t) => {
          const due = t.dueDate ? dueLabel(t.dueDate, today) : null;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openTask(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <PriorityIndicator value={t.priority} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium",
                      t.status === "DONE" && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {t.projectName ?? "Internal"}
                    {t.labels.slice(0, 2).map((l) => (
                      <LabelChip key={l.id} label={l} />
                    ))}
                  </span>
                </span>
                <StatusBadge kind="task" value={t.status} className="hidden sm:inline-flex" />
                {due && t.status !== "DONE" && (
                  <span
                    className={cn(
                      "hidden w-24 text-right text-xs sm:block",
                      due.overdue ? "font-medium text-danger" : "text-muted-foreground",
                    )}
                  >
                    {due.text}
                  </span>
                )}
                {t.assigneeName ? (
                  <UserAvatar name={t.assigneeName} src={t.assigneeAvatar} size="sm" />
                ) : (
                  <span className="size-6" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
