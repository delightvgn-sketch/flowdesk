"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { EnumSelect, OptionSelect } from "@/components/shared/option-select";
import type { Person } from "@/components/shared/people-picker";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FileList } from "@/features/files/components/file-list";
import { FileUploader } from "@/features/files/components/file-uploader";
import { addComment, deleteComment, deleteTask, fetchTaskDetail, updateTask } from "@/features/tasks/actions";
import { useAction } from "@/hooks/use-action";
import { PRIORITIES, PRIORITY_META, TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/lib/dates";
import type { TaskStatus } from "@/server/db/schema";

import type { TaskDetail, TaskLabel } from "../types";
import { LabelPicker } from "./label-picker";

/** Open the task sheet without a server round-trip (shallow URL update). */
export function openTask(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("task", id);
  window.history.pushState(null, "", url);
}

function closeTaskUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("task");
  window.history.pushState(null, "", url);
}

export type TaskSheetOptions = {
  projects: { id: string; label: string }[];
  people: Person[];
  labels: TaskLabel[];
  currentProfileId: string;
  canDeleteAny: boolean;
  allowNoProject: boolean;
};

export function TaskSheet({ options }: { options: TaskSheetOptions }) {
  const params = useSearchParams();
  const router = useRouter();
  const taskId = params.get("task");
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const load = useCallback(
    (id: string) =>
      startLoading(async () => {
        const result = await fetchTaskDetail({ id });
        if (result.ok) {
          setTask(result.data);
          setError(null);
        } else {
          setTask(null);
          setError(result.error);
        }
      }),
    [],
  );

  useEffect(() => {
    if (taskId) load(taskId);
    else setTask(null);
  }, [taskId, load]);

  const refresh = () => {
    if (taskId) load(taskId);
    router.refresh();
  };

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && closeTaskUrl()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {!task ? (
          <div className="space-y-4 p-6">
            <SheetHeader className="p-0">
              <SheetTitle>{error ? "Task unavailable" : "Loading task…"}</SheetTitle>
              <SheetDescription>{error ?? " "}</SheetDescription>
            </SheetHeader>
            {!error && (
              <>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </>
            )}
          </div>
        ) : (
          <TaskEditor key={task.id} task={task} options={options} onChanged={refresh} loading={loading} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskEditor({ task, options, onChanged, loading }: { task: TaskDetail; options: TaskSheetOptions; onChanged: () => void; loading: boolean }) {
  const [labels, setLabels] = useState(options.labels);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    dueDate: task.dueDate ?? "",
    labelIds: task.labels.map((l) => l.id),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useAction(updateTask, { onSuccess: onChanged });
  const remove = useAction(deleteTask, {
    success: "Task deleted.",
    onSuccess: () => {
      setConfirmDelete(false);
      closeTaskUrl();
      onChanged();
    },
  });

  /** Persist immediately — each field saves on change (or on blur for text). */
  function commit(change: Partial<typeof draft>, message?: string) {
    const next = { ...draft, ...change };
    setDraft(next);
    if (!next.title.trim()) return toast.error("Title can't be empty.");
    void save.execute({ id: task.id, ...next }).then((r) => r.ok && message && toast.success(message));
  }

  const canDelete = options.canDeleteAny || task.createdById === options.currentProfileId;

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader className="gap-3 border-b px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
          {task.projectId ? (
            <Link href={`/projects/${task.projectId}?tab=tasks`} className="truncate hover:text-foreground">
              {task.projectName}
            </Link>
          ) : (
            <span>Internal task</span>
          )}
          {(save.pending || loading) && <Loader2 className="size-3 animate-spin" aria-label="Saving" />}
        </div>
        <SheetTitle className="sr-only">{draft.title}</SheetTitle>
        <SheetDescription className="sr-only">Task details</SheetDescription>
        <Input
          aria-label="Task title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onBlur={() => draft.title !== task.title && commit({})}
          className="h-auto border-transparent bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:border-input focus-visible:px-2"
        />
      </SheetHeader>

      <div className="grid gap-4 border-b px-5 py-5 sm:grid-cols-2 sm:px-6">
        <Field label="Status">
          {(p) => <EnumSelect {...p} values={TASK_STATUSES} labels={TASK_STATUS_META} value={draft.status} onChange={(v: TaskStatus) => commit({ status: v }, v === "DONE" ? "Task completed." : undefined)} />}
        </Field>
        <Field label="Priority">
          {(p) => <EnumSelect {...p} values={PRIORITIES} labels={PRIORITY_META} value={draft.priority} onChange={(v) => commit({ priority: v })} />}
        </Field>
        <Field label="Assignee">
          {(p) => (
            <OptionSelect
              {...p}
              options={options.people.map((x) => ({ id: x.id, label: x.fullName }))}
              value={draft.assigneeId}
              onChange={(v) => commit({ assigneeId: v }, v ? "Task assigned." : "Task unassigned.")}
              noneLabel="Unassigned"
            />
          )}
        </Field>
        <Field label="Due date">
          {(p) => <Input {...p} type="date" value={draft.dueDate} onChange={(e) => commit({ dueDate: e.target.value })} />}
        </Field>
        <Field label="Project">
          {(p) => (
            <OptionSelect
              {...p}
              options={options.projects}
              value={draft.projectId}
              onChange={(v) => commit({ projectId: v })}
              noneLabel={options.allowNoProject ? "No project" : undefined}
            />
          )}
        </Field>
        <Field label="Labels">
          {(p) => <LabelPicker id={p.id} labels={labels} value={draft.labelIds} onChange={(ids) => commit({ labelIds: ids })} onLabelCreated={(l) => setLabels((ls) => [...ls, l])} />}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(p) => (
            <Textarea
              {...p}
              rows={5}
              value={draft.description}
              placeholder="Add more detail…"
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              onBlur={() => draft.description !== (task.description ?? "") && commit({}, "Description saved.")}
            />
          )}
        </Field>
      </div>

      <section className="border-b px-5 py-5 sm:px-6" aria-labelledby="attachments-heading">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="attachments-heading" className="text-sm font-semibold">
            Attachments <span className="font-normal text-muted-foreground">{task.attachments.length}</span>
          </h3>
          <FileUploader links={{ taskId: task.id }} label="Attach" size="sm" variant="outline" />
        </div>
        {task.attachments.length > 0 ? (
          <FileList files={task.attachments.map((a) => ({ ...a, sharedWithClient: false }))} currentProfileId={options.currentProfileId} canOrganize={false} canDeleteAny={options.canDeleteAny} showProject={false} />
        ) : (
          <p className="text-sm text-muted-foreground">No attachments yet.</p>
        )}
      </section>

      <Comments task={task} currentProfileId={options.currentProfileId} canDeleteAny={options.canDeleteAny} onChanged={onChanged} />

      <section className="px-5 py-5 sm:px-6" aria-labelledby="task-activity-heading">
        <h3 id="task-activity-heading" className="mb-3 text-sm font-semibold">
          Activity
        </h3>
        <ul className="space-y-2 text-xs text-muted-foreground">
          {task.activity.map((a) => (
            <li key={a.id}>
              <span className="font-medium text-foreground">{a.actorName ?? "Someone"}</span> {activityVerb(a.action, a.metadata)} · {timeAgo(a.createdAt)}
            </li>
          ))}
          <li>
            Created {task.createdByName ? `by ${task.createdByName} ` : ""}on {formatDateTime(task.createdAt)}
          </li>
        </ul>
      </section>

      {canDelete && (
        <div className="mt-auto border-t px-5 py-3 sm:px-6">
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete task
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description="Comments and history will be removed. Attachments stay in Files."
        confirmLabel="Delete task"
        pending={remove.pending}
        onConfirm={() => remove.execute({ id: task.id })}
      />
    </div>
  );
}

function activityVerb(action: string, metadata: Record<string, string | number | boolean | null> | null) {
  switch (action) {
    case "task.created":
      return "created this task";
    case "task.completed":
      return "completed this task";
    case "task.status_changed":
      return `moved it to ${TASK_STATUS_META[metadata?.to as TaskStatus]?.label ?? "a new status"}`;
    case "task.assigned":
      return "changed the assignee";
    case "comment.posted":
      return "commented";
    default:
      return action.replace("task.", "").replace("_", " ");
  }
}

function Comments({ task, currentProfileId, canDeleteAny, onChanged }: { task: TaskDetail; currentProfileId: string; canDeleteAny: boolean; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const post = useAction(addComment, {
    onSuccess: () => {
      setBody("");
      onChanged();
    },
  });
  const remove = useAction(deleteComment, { success: "Comment deleted.", onSuccess: onChanged });

  return (
    <section className="border-b px-5 py-5 sm:px-6" aria-labelledby="comments-heading">
      <h3 id="comments-heading" className="mb-4 text-sm font-semibold">
        Comments <span className="font-normal text-muted-foreground">{task.comments.length}</span>
      </h3>
      <ul className="mb-4 space-y-4">
        {task.comments.map((c) => (
          <li key={c.id} className="group flex gap-3">
            <UserAvatar name={c.authorName ?? "Someone"} src={c.authorAvatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-medium">{c.authorName ?? "Someone"}</span>{" "}
                <time className="text-subtle-foreground" dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                  {timeAgo(c.createdAt)}
                </time>
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
            {(c.authorId === currentProfileId || canDeleteAny) && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Delete comment"
                onClick={() => remove.execute({ id: c.id })}
              >
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) post.execute({ taskId: task.id, body });
        }}
      >
        <Textarea
          aria-label="Write a comment"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) post.execute({ taskId: task.id, body });
          }}
          placeholder="Write a comment… (⌘↵ to send)"
          className="min-h-16"
        />
        <Button type="submit" size="icon" disabled={post.pending || !body.trim()} aria-label="Post comment">
          {post.pending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </section>
  );
}
