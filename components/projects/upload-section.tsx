"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  ACCEPTED_EXTS,
  MAX_FILE_SIZE,
  UPLOAD_CONCURRENCY,
  hasAcceptedExt,
} from "@/lib/domain/ghg";
import type { Document } from "@/lib/domain/ghg";
import {
  uploadDocumentsConcurrently,
  type UploadProgress,
} from "@/lib/ghg/upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadItem } from "@/components/projects/upload-item";

const ACCEPT_ATTR = ACCEPTED_EXTS.join(",");

export interface UploadSectionProps {
  projectId: string;
  onDocumentUploaded: (document: Document) => void;
}

export function UploadSection({
  projectId,
  onDocumentUploaded,
}: UploadSectionProps) {
  const [items, setItems] = useState<Map<string, UploadProgress>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const validateAndCollect = useCallback((fileList: FileList | File[]): File[] => {
    const files = Array.from(fileList);
    const accepted: File[] = [];
    for (const file of files) {
      if (!hasAcceptedExt(file.name)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: exceeds 50 MB limit`);
        continue;
      }
      accepted.push(file);
    }
    return accepted;
  }, []);

  const startUploads = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      // Prime the progress map with queued entries so the UI shows them immediately.
      setItems((prev) => {
        const next = new Map(prev);
        for (const file of files) {
          const key = `${file.name}:${file.size}:${Date.now()}:${Math.random()}`;
          next.set(key, {
            documentId: key,
            filename: file.name,
            size: file.size,
            phase: "queued",
          });
        }
        return next;
      });

      await uploadDocumentsConcurrently(
        projectId,
        files,
        UPLOAD_CONCURRENCY,
        (progress) => {
          setItems((prev) => {
            const next = new Map(prev);
            // Reconcile: find an existing queued entry with the same filename/size
            // that has no real documentId yet and replace it; otherwise insert.
            let replacedKey: string | null = null;
            for (const [key, value] of next) {
              if (
                value.phase === "queued" &&
                value.filename === progress.filename &&
                value.size === progress.size
              ) {
                replacedKey = key;
                break;
              }
            }
            if (replacedKey) next.delete(replacedKey);
            next.set(progress.documentId, progress);
            return next;
          });

          if (progress.phase === "done" && progress.document) {
            onDocumentUploaded(progress.document);
            // Clear done rows shortly after, so the upload list stays focused on in-flight work.
            setTimeout(() => {
              setItems((prev) => {
                const next = new Map(prev);
                next.delete(progress.documentId);
                return next;
              });
            }, 1200);
          }
        },
      );
    },
    [projectId, onDocumentUploaded],
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = validateAndCollect(fileList);
      void startUploads(files);
    },
    [startUploads, validateAndCollect],
  );

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  const openPicker = () => inputRef.current?.click();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  useEffect(() => {
    // Prevent the browser from navigating when a file is dropped outside the zone.
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const progressList = Array.from(items.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload documents</CardTitle>
        <CardDescription>
          Drag & drop or click to pick. Supported: {ACCEPTED_EXTS.join(" ")} (max 50 MB each).
          Uploads run {UPLOAD_CONCURRENCY} at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files"
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-foreground/30 hover:bg-accent/30",
          )}
        >
          <Upload
            className={cn(
              "size-8 mb-3",
              isDragging ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <p className="text-sm font-medium">
            {isDragging ? "Drop files to upload" : "Drop files here, or click to pick"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ACCEPTED_EXTS.join(", ")} · up to 50 MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {progressList.length > 0 ? (
          <div className="space-y-2">
            {progressList.map((p) => (
              <UploadItem key={p.documentId} progress={p} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
