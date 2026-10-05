"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { confirmUpload, prepareUpload } from "@/features/files/actions";
import { ALLOWED_MIME_TYPES, fileUploadSchema, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { cn, formatBytes } from "@/lib/utils";

type Links = {
  folderId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
  sharedWithClient?: boolean;
};
type Item = { id: string; name: string; progress: number; error?: string };

/** Some browsers report an empty type for e.g. .md files; infer from the extension. */
function mimeFor(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (
    ({ md: "text/markdown", csv: "text/csv", txt: "text/plain", json: "application/json" } as Record<string, string>)[
      ext ?? ""
    ] ?? "application/octet-stream"
  );
}

function putWithProgress(url: string, file: File, contentType: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function FileUploader({
  links = {},
  label = "Upload files",
  variant = "default",
  size = "default",
  className,
}: {
  links?: Links;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const busy = items.some((i) => i.progress < 100 && !i.error);

  const patch = (id: string, change: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));

  async function uploadOne(file: File) {
    const id = crypto.randomUUID();
    const meta = { name: file.name, mimeType: mimeFor(file), sizeBytes: file.size, ...links };
    setItems((list) => [...list, { id, name: file.name, progress: 0 }]);

    const check = fileUploadSchema.safeParse(meta);
    if (!check.success) {
      patch(id, { error: check.error.issues[0]?.message ?? "Invalid file" });
      return false;
    }
    const prepared = await prepareUpload(check.data);
    if (!prepared.ok) {
      patch(id, { error: prepared.error });
      return false;
    }
    try {
      await putWithProgress(prepared.data.signedUrl, file, meta.mimeType, (pct) => patch(id, { progress: Math.min(pct, 99) }));
    } catch (e) {
      patch(id, { error: (e as Error).message });
      return false;
    }
    const confirmed = await confirmUpload({ ...check.data, path: prepared.data.path });
    if (!confirmed.ok) {
      patch(id, { error: confirmed.error });
      return false;
    }
    patch(id, { progress: 100 });
    return true;
  }

  async function handle(list: FileList | null) {
    if (!list?.length) return;
    const results = await Promise.all(Array.from(list).slice(0, 10).map(uploadOne));
    const ok = results.filter(Boolean).length;
    if (ok) {
      toast.success(ok === 1 ? "File uploaded." : `${ok} files uploaded.`);
      router.refresh();
    }
    setTimeout(() => setItems((l) => l.filter((i) => i.error)), 1500);
    if (input.current) input.current.value = "";
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        accept={ALLOWED_MIME_TYPES.join(",")}
        onChange={(e) => handle(e.target.files)}
        aria-hidden
      />
      <Button type="button" variant={variant} size={size} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {busy ? "Uploading…" : label}
      </Button>
      {items.length > 0 && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-lg border bg-popover p-3 shadow-md"
          role="status"
          aria-live="polite"
        >
          {items.map((item) => (
            <div key={item.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{item.name}</span>
                {item.error ? (
                  <button type="button" aria-label="Dismiss" onClick={() => setItems((l) => l.filter((i) => i.id !== item.id))}>
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                ) : (
                  <span className="tabular text-muted-foreground">{item.progress}%</span>
                )}
              </div>
              {item.error ? (
                <p className="mt-0.5 text-danger">{item.error}</p>
              ) : (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Max {formatBytes(MAX_UPLOAD_BYTES)} per file.</p>
        </div>
      )}
    </div>
  );
}
