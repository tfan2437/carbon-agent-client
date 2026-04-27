"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/projects/v6-status-pill";
import {
  formatRelative,
  mapDocStatus,
} from "@/components/projects/v6-doc-row-helpers";
import type { DedupResult } from "@/lib/ghg/dedup";

export type ResolutionChoice = "keep" | "rename" | "replace";

const OPTIONS: { value: ResolutionChoice; label: string }[] = [
  { value: "keep", label: "Keep existing" },
  { value: "rename", label: "Upload as separate copy" },
  { value: "replace", label: "Replace" },
];

interface UploadConflictDialogProps {
  open: boolean;
  conflicts: DedupResult[];
  onResolve: (resolutions: Map<File, ResolutionChoice>) => void;
  onCancel: () => void;
}

export const UploadConflictDialog: React.FC<UploadConflictDialogProps> = ({
  open,
  conflicts,
  onResolve,
  onCancel,
}) => {
  const [choices, setChoices] = React.useState<Map<File, ResolutionChoice>>(
    () => new Map(),
  );

  const setChoice = React.useCallback(
    (file: File, choice: ResolutionChoice) => {
      setChoices((prev) => {
        const next = new Map(prev);
        next.set(file, choice);
        return next;
      });
    },
    [],
  );

  const allResolved = conflicts.every((c) => choices.has(c.file));

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Resolve {conflicts.length} name{" "}
            {conflicts.length === 1 ? "conflict" : "conflicts"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {conflicts.length === 1
              ? "A file with this name exists in this project, but its contents are different. Pick what to do."
              : "Files with these names exist in this project, but their contents are different. Pick what to do for each."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul
          style={{
            maxHeight: 360,
            overflowY: "auto",
            margin: "8px 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {conflicts.map((c) => (
            <ConflictRow
              key={`${c.file.name}-${c.hash}`}
              conflict={c}
              choice={choices.get(c.file)}
              onChoose={(choice) => setChoice(c.file, choice)}
            />
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!allResolved}
            onClick={(e) => {
              e.preventDefault();
              if (allResolved) onResolve(choices);
            }}
          >
            Apply
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ConflictRow: React.FC<{
  conflict: DedupResult;
  choice: ResolutionChoice | undefined;
  onChoose: (choice: ResolutionChoice) => void;
}> = ({ conflict, choice, onChoose }) => {
  const existing = conflict.existing;
  if (!existing) return null;
  const v6Status = mapDocStatus(existing.status);
  const replaceBlocked = existing.status !== "uploaded";
  const replaceTooltip = replaceBlocked
    ? "Cannot replace: existing file has been processed. Replacing would delete its records and emission results."
    : undefined;

  return (
    <li
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          style={{
            color: "var(--fg)",
            fontSize: 13.5,
            fontWeight: 510,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
          title={conflict.file.name}
        >
          {conflict.file.name}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--fg-3)",
        }}
      >
        <span>Existing:</span>
        <StatusPill status={v6Status} small />
        <span>·</span>
        <span>uploaded {formatRelative(existing.uploaded_at)}</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {OPTIONS.map((opt) => {
          const disabled = opt.value === "replace" && replaceBlocked;
          const active = choice === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              title={disabled ? replaceTooltip : undefined}
              onClick={() => onChoose(opt.value)}
              style={{
                height: 28,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                border: `1px solid ${
                  active ? "var(--primary-line)" : "var(--border)"
                }`,
                background: active
                  ? "var(--primary-soft)"
                  : disabled
                    ? "transparent"
                    : "rgba(255,255,255,0.02)",
                color: active
                  ? "var(--primary)"
                  : disabled
                    ? "var(--fg-4)"
                    : "var(--fg-2)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: "background 140ms, border-color 140ms",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </li>
  );
};
