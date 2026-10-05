import type { Priority, TaskStatus } from "@/server/db/schema";

export type TaskLabel = { id: string; name: string; color: string };

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  position: number;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  commentCount: number;
  labels: TaskLabel[];
};

export type TaskDetail = BoardTask & {
  description: string | null;
  createdAt: string;
  completedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  comments: {
    id: string;
    body: string;
    createdAt: string;
    authorId: string | null;
    authorName: string | null;
    authorAvatar: string | null;
  }[];
  attachments: { id: string; name: string; sizeBytes: number; mimeType: string; createdAt: string }[];
  activity: {
    id: string;
    action: string;
    actorName: string | null;
    createdAt: string;
    metadata: Record<string, string | number | boolean | null> | null;
  }[];
};
