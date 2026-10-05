"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { moveTask } from "@/features/tasks/actions";
import { TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { useSyncedState } from "@/hooks/use-synced-state";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/server/db/schema";

import type { BoardTask } from "../types";
import { TaskCard } from "./task-card";
import { openTask } from "./task-sheet";

type Columns = Record<TaskStatus, BoardTask[]>;

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: "bg-subtle-foreground",
  IN_PROGRESS: "bg-primary",
  REVIEW: "bg-warning",
  DONE: "bg-success",
};

function group(tasks: BoardTask[]): Columns {
  const cols: Columns = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
  for (const t of tasks) cols[t.status].push(t);
  return cols;
}

function findColumn(cols: Columns, id: string): TaskStatus | null {
  if ((TASK_STATUSES as readonly string[]).includes(id)) return id as TaskStatus;
  return TASK_STATUSES.find((s) => cols[s].some((t) => t.id === id)) ?? null;
}

export function KanbanBoard({
  tasks,
  today,
  canCreate,
  onCreate,
}: {
  tasks: BoardTask[];
  today: string;
  canCreate: boolean;
  onCreate: (status: TaskStatus) => void;
}) {
  const router = useRouter();
  // Optimistic column state, re-derived whenever fresh tasks arrive from the server.
  const grouped = useMemo(() => group(tasks), [tasks]);
  const [columns, setColumns] = useSyncedState<Columns>(grouped);
  const [active, setActive] = useState<BoardTask | null>(null);
  const origin = useRef<TaskStatus | null>(null);
  // Stable id keeps dnd-kit's generated aria ids identical on server and client.
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "Task";
  const columnOf = (id: string | number | undefined) => {
    if (!id) return "";
    const col = findColumn(columns, String(id));
    return col ? TASK_STATUS_META[col].label : "";
  };
  const announcements: Announcements = useMemo(
    () => ({
      onDragStart: ({ active: a }) => `Picked up ${titleOf(a.id)}. Use arrow keys to move, Space to drop, Escape to cancel.`,
      onDragOver: ({ active: a, over }) => (over ? `${titleOf(a.id)} is over ${columnOf(over.id)}.` : undefined),
      onDragEnd: ({ active: a, over }) =>
        over ? `${titleOf(a.id)} dropped in ${columnOf(over.id)}.` : `${titleOf(a.id)} dropped.`,
      onDragCancel: ({ active: a }) => `Moving ${titleOf(a.id)} was cancelled.`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, tasks],
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    origin.current = findColumn(columns, id);
    setActive(tasks.find((t) => t.id === id) ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over) return;
    const from = findColumn(columns, String(a.id));
    const to = findColumn(columns, String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const moving = cols[from].find((t) => t.id === a.id);
      if (!moving) return cols;
      const overIndex = cols[to].findIndex((t) => t.id === over.id);
      const index = overIndex >= 0 ? overIndex : cols[to].length;
      const next = [...cols[to]];
      next.splice(index, 0, { ...moving, status: to });
      return { ...cols, [from]: cols[from].filter((t) => t.id !== a.id), [to]: next };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    setActive(null);
    const startedIn = origin.current;
    origin.current = null;
    if (!over) return setColumns(group(tasks));

    const column = findColumn(columns, String(a.id));
    if (!column) return;
    let list = columns[column];
    const oldIndex = list.findIndex((t) => t.id === a.id);
    const overIndex = list.findIndex((t) => t.id === over.id);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      list = arrayMove(list, oldIndex, overIndex);
      setColumns((cols) => ({ ...cols, [column]: list }));
    }
    const index = list.findIndex((t) => t.id === a.id);
    if (startedIn === column && index === tasks.filter((t) => t.status === column).findIndex((t) => t.id === a.id)) return;

    const result = await moveTask({
      id: String(a.id),
      status: column,
      beforeId: list[index - 1]?.id ?? null,
      afterId: list[index + 1]?.id ?? null,
    });
    if (!result.ok) {
      toast.error(result.error);
      setColumns(group(tasks));
      return;
    }
    if (startedIn !== column && column === "DONE") toast.success("Task completed.");
    router.refresh();
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        setColumns(group(tasks));
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a task, press Space, then use the arrow keys. Press Space again to drop it, or Escape to cancel. Press Enter to open the task.",
        },
      }}
    >
      <div className="-mx-4 flex snap-x snap-mandatory scrollbar-none gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columns[status]}
            today={today}
            canCreate={canCreate}
            onCreate={() => onCreate(status)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>
        {active ? <TaskCard task={active} today={today} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  tasks,
  today,
  canCreate,
  onCreate,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  today: string;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `column-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-xl border bg-muted/40 sm:w-auto sm:max-w-none",
        isOver && "border-primary/40 bg-brand-soft/40",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span aria-hidden className={cn("size-2 rounded-full", COLUMN_ACCENT[status])} />
        <h2 id={headingId} className="text-[13px] font-semibold">
          {TASK_STATUS_META[status].label}
        </h2>
        <span className="tabular text-xs text-muted-foreground">{tasks.length}</span>
        {canCreate && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            onClick={onCreate}
            aria-label={`Add task to ${TASK_STATUS_META[status].label}`}
          >
            <Plus />
          </Button>
        )}
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} today={today} />
          ))}
          {tasks.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-6 text-xs text-muted-foreground">
              Drop tasks here
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableTask({ task, today }: { task: BoardTask; today: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const handle = useRef<HTMLButtonElement | null>(null);

  return (
    <li>
      {/* The whole card drags with a pointer; keyboard dragging uses the handle so
          Space/Enter on the title or menu never start a drag by accident. */}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn("touch-manipulation", isDragging && "opacity-40")}
        {...listeners}
        onKeyDown={(e) => {
          if (e.target === handle.current) listeners?.onKeyDown?.(e);
        }}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button, a, [role=menuitem]")) openTask(task.id);
        }}
      >
        <TaskCard
          task={task}
          today={today}
          handleProps={{
            ref: (node: HTMLButtonElement | null) => {
              handle.current = node;
              setActivatorNodeRef(node);
            },
            ...attributes,
            "aria-roledescription": "Drag handle",
            "aria-label": `Move ${task.title} between columns`,
          }}
        />
      </div>
    </li>
  );
}
