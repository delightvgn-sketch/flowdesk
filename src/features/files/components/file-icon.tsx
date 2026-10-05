import { File, FileArchive, FileAudio, FileCode2, FileImage, FileSpreadsheet, FileText, FileVideo } from "lucide-react";

import { cn } from "@/lib/utils";

export function fileKind(mime: string): string {
  if (mime.startsWith("image/")) return "Image";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "Spreadsheet";
  if (mime.includes("word")) return "Document";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Slides";
  if (mime.includes("zip")) return "Archive";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime === "text/markdown") return "Markdown";
  if (mime === "application/json") return "JSON";
  if (mime.startsWith("text/")) return "Text";
  return "File";
}

export function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const kind = fileKind(mime);
  const Icon =
    kind === "Image"
      ? FileImage
      : kind === "Spreadsheet"
        ? FileSpreadsheet
        : kind === "Archive"
          ? FileArchive
          : kind === "Video"
            ? FileVideo
            : kind === "Audio"
              ? FileAudio
              : kind === "JSON"
                ? FileCode2
                : kind === "File"
                  ? File
                  : FileText;
  const tone =
    kind === "PDF"
      ? "text-danger bg-danger-soft"
      : kind === "Image"
        ? "text-info bg-info-soft"
        : kind === "Spreadsheet"
          ? "text-success bg-success-soft"
          : "text-muted-foreground bg-muted";
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", tone, className)}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
