"use client";

import React, { useId } from "react";
import { IconLibrary, IconX } from "@tabler/icons-react";
import type { FormCatalogEntry } from "@/lib/crf";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { FormCatalogList } from "./FormCatalogList";

interface FormCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: readonly FormCatalogEntry[];
  onAdd: (entry: FormCatalogEntry) => void;
  canInsertBlocks: boolean;
  /** Names where a form goes, e.g. the selected visit. */
  targetLabel: string;
}

/** The studio's single place to add a ready-made form or block. */
export function FormCatalogModal({
  isOpen,
  onClose,
  entries,
  onAdd,
  canInsertBlocks,
  targetLabel,
}: FormCatalogModalProps) {
  const titleId = useId();
  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      titleId={titleId}
      maxWidth="max-w-3xl"
      className="studio-surface-elevated studio-border-default studio-fg-primary"
    >
      <div className="flex items-start justify-between gap-3 border-b studio-border-default studio-surface-rail px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconLibrary
            className="mt-0.5 h-5 w-5 shrink-0 studio-fg-amber"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-base font-bold font-mono studio-fg-primary"
            >
              Add a form or block
            </h3>
            <p className="break-words text-xs studio-fg-muted">
              Forms go to {targetLabel}. Blocks go into the open form, as with
              the slash palette.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the form catalog"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg studio-fg-muted transition-colors studio-hover-surface studio-hover-fg-primary sm:min-h-0 sm:min-w-0 sm:p-1.5"
        >
          <IconX className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <FormCatalogList
          entries={entries}
          canInsertBlocks={canInsertBlocks}
          onAdd={(entry) => {
            onAdd(entry);
            onClose();
          }}
        />
      </div>
    </ModalContainer>
  );
}
