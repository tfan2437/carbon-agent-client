"use client";

import { useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Document } from "@/lib/domain/ghg";
import { deleteDocument } from "@/lib/ghg/upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DocumentStatusBadge } from "@/components/projects/document-status-badge";

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface DocumentsSectionProps {
  documents: Document[];
  onDocumentDeleted: (documentId: string) => void;
}

export function DocumentsSection({
  documents,
  onDocumentDeleted,
}: DocumentsSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(doc: Document) {
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id, doc.storage_path);
      onDocumentDeleted(doc.id);
      toast.success(`Deleted ${doc.filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {documents.length === 0
                ? "No documents yet."
                : `${documents.length} document${documents.length === 1 ? "" : "s"} attached to this project.`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Upload files above to get started.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Size</TableHead>
                  <TableHead className="w-[160px]">Uploaded</TableHead>
                  <TableHead className="w-[64px] text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const deletable =
                    doc.status === "uploaded" || doc.status === "failed";
                  const busy = deletingId === doc.id;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <FileText
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="truncate" title={doc.filename}>
                            {doc.filename}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatSize(doc.file_size_bytes)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(doc.uploaded_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={!deletable || busy}
                              aria-label={`Delete ${doc.filename}`}
                            >
                              {busy ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="size-4" aria-hidden />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the file from Storage and the database. This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(doc)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
