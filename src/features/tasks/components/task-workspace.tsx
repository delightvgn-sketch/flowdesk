"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/server/db/schema";

import type { BoardTask } from "../types";
import { KanbanBoard } from "./kanban-board";
import { TaskFormDialog, type TaskFormOptions } from "./task-form-dialog";
import { TaskSheet, type TaskSheetOptions } from "./task-sheet";

/** Board + create dialog + detail sheet, shared by /tasks and the project Tasks tab. */
export function TaskWorkspace({
  tasks,
  today,
  formOptions,
  sheetOptions,
  defaultProjectId,
  view = "board",
  children,
}: {
  tasks: BoardTask[];
  today: string;
  formOptions: TaskFormOptions;
  sheetOptions: TaskSheetOptions;
  defaultProjectId?: string;
  view?: "board" | "list";
  /** Server-rendered list view, when view === "list". */
  children?: React.ReactNode;
}) {
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const canCreate = formOptions.projects.length > 0 || formOptions.allowNoProject;

  return (
    <>
      {view === "board" ? (
        <KanbanBoard tasks={tasks} today={today} canCreate={canCreate} onCreate={(s) => setCreateStatus(s)} />
      ) : (
        children
      )}
      <TaskFormDialog
        open={createStatus !== null}
        onOpenChange={(o) => !o && setCreateStatus(null)}
        options={formOptions}
        defaults={{ status: createStatus ?? "TODO", projectId: defaultProjectId ?? null }}
      />
      <TaskSheet options={sheetOptions} />
    </>
  );
}

/** Header button; also opens for ?new=1 (⌘K "New task"). */
export function NewTaskButton({ formOptions, defaultProjectId }: { formOptions: TaskFormOptions; defaultProjectId?: string }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (params.get("new") === "1") {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname]);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={formOptions.projects.length === 0 && !formOptions.allowNoProject}>
        <Plus /> New task
      </Button>
      <TaskFormDialog open={open} onOpenChange={setOpen} options={formOptions} defaults={{ projectId: defaultProjectId ?? null }} />
    </>
  );
}
