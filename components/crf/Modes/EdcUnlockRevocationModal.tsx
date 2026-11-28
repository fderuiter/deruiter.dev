"use client";

import React, { useState } from "react";
import { ElectronicSignature } from "@/lib/crf/types";
import { ModalContainer } from "@/components/ui/ModalContainer";
import {
  IconCheck,
  IconInfoCircle,
  IconLockOpen,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";

interface EdcUnlockRevocationModalProps {
  subjectId: string;
  visitLabel: string;
  formDomain: string;
  formName: string;
  actorLabel: string;
  revokedSignature?: ElectronicSignature;
  onClose: () => void;
  onConfirm: (reasonForChange: string) => void;
}

const MAX_REASON_LENGTH = 250;

export const EdcUnlockRevocationModal: React.FC<
  EdcUnlockRevocationModalProps
> = ({
  subjectId,
  visitLabel,
  formDomain,
  formName,
  actorLabel,
  revokedSignature,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  const signatureSummary = revokedSignature
    ? `${revokedSignature.signedBy} (${revokedSignature.meaning} · ${revokedSignature.digest})`
    : `${actorLabel} (Data Lock)`;

  const handleConfirm = () => {
    if (!trimmedReason) return;
    onConfirm(trimmedReason);
  };

  return (
    <ModalContainer
      isOpen={true}
      onClose={onClose}
      titleId="edc-unlock-revocation-title"
      maxWidth="max-w-xl"
      overlayClassName="studio-surface-scrim"
      className="studio-surface-elevated studio-border-strong studio-fg-primary overflow-hidden"
    >
      {/* Modal Header */}
      <div className="px-5 py-4 studio-surface-subtle border-b studio-border-default flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl studio-accent-red border flex items-center justify-center shrink-0">
            <IconLockOpen className="w-4 h-4 studio-fg-red" />
          </span>
          <div className="min-w-0">
            <h3
              id="edc-unlock-revocation-title"
              className="text-sm font-bold studio-fg-primary font-mono truncate"
            >
              21 CFR Part 11 Unlock &amp; Signature Revocation
            </h3>
            <span className="block text-[10px] font-mono studio-fg-red uppercase tracking-wider font-semibold">
              Action: Invalidation of Signed CRF Record
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss unlock revocation dialog"
          onClick={onClose}
          className="min-h-12 min-w-12 flex items-center justify-center rounded-xl studio-fg-muted studio-hover-fg-primary transition-colors shrink-0"
        >
          <IconX className="w-4 h-4" />
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-5 space-y-4">
        {/* Regulatory Guidance Notice */}
        <div className="p-3 rounded-xl studio-surface-card border studio-border-default flex items-start gap-2.5">
          <IconInfoCircle className="w-4 h-4 studio-fg-cyan shrink-0 mt-0.5" />
          <p className="text-xs studio-fg-secondary font-sans leading-relaxed">
            Unlocking this form revokes the active{" "}
            <strong className="studio-fg-primary font-semibold">
              Data Lock electronic signature
            </strong>{" "}
            and records a chronological, append-only Part 11-style audit entry.
            Re-signing by an authorized Investigator will be mandatory prior to
            final database freeze.
          </p>
        </div>

        {/* Target Scope Summary Box */}
        <div className="p-3.5 rounded-xl studio-surface-subtle border studio-border-default space-y-2 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] studio-fg-muted uppercase">
              SUBJECT &amp; VISIT:
            </span>
            <span className="studio-fg-cyan font-bold">
              Subject: {subjectId} · Visit: {visitLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] studio-fg-muted uppercase">
              TARGET MODULE:
            </span>
            <span className="studio-fg-primary font-semibold">
              [{formDomain}] {formName}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] studio-fg-muted uppercase">
              REVOKED SIGNATURE:
            </span>
            <span className="studio-fg-red font-medium">
              {signatureSummary}
            </span>
          </div>
        </div>

        {/* Mandatory Justification Reason */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="edc-unlock-justification-reason"
              className="text-[11px] font-mono uppercase tracking-wider studio-fg-primary font-bold"
            >
              Unlock Justification Reason{" "}
              <span className="studio-fg-red">*</span>
            </label>
            <span className="text-[10px] font-mono studio-fg-emerald font-semibold">
              21 CFR PART 11.10(e) MANDATE
            </span>
          </div>
          <textarea
            id="edc-unlock-justification-reason"
            rows={3}
            maxLength={MAX_REASON_LENGTH}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter clinical justification for revoking Data Lock signature (e.g., Amend screening blood pressure after source chart reconciliation)..."
            className="w-full px-3 py-2 text-xs studio-surface-card border studio-border-strong rounded-xl studio-fg-primary font-mono studio-focus-input focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between text-[10px] font-mono studio-fg-muted">
            <span>
              AUDIT ACTION:{" "}
              <strong className="studio-fg-cyan">FORM_UNLOCK</strong>
            </span>
            <span>
              Character Count: {reason.length} / {MAX_REASON_LENGTH}
            </span>
          </div>
        </div>

        {/* Authenticated Investigator Credentials Indicator */}
        <div className="p-3 rounded-xl studio-surface-card border studio-border-default flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-full studio-accent-cyan border flex items-center justify-center shrink-0">
              <IconShieldCheck className="w-4 h-4 studio-fg-cyan" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-mono studio-fg-primary font-bold uppercase">
                PI CREDENTIALS CONFIRMED
              </div>
              <div className="text-xs font-sans studio-fg-muted truncate">
                {actorLabel}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg studio-accent-emerald border text-[10px] font-mono font-semibold">
            <IconCheck className="w-3 h-3" />
            <span>TOKEN VALID</span>
          </span>
        </div>
      </div>

      {/* Modal Action Footer */}
      <div className="px-5 py-3.5 studio-surface-subtle border-t studio-border-default flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 px-4 py-2 rounded-xl studio-surface-muted studio-hover-active studio-fg-secondary text-xs font-mono font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!trimmedReason}
          onClick={handleConfirm}
          className="min-h-12 px-4 py-2 rounded-xl studio-btn-cyan text-xs font-mono font-bold inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconLockOpen className="w-4 h-4" />
          <span>Revoke Signature &amp; Unlock</span>
        </button>
      </div>
    </ModalContainer>
  );
};
