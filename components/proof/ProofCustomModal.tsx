"use client";

import React, { useId } from "react";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { IconPlus, IconX } from "@tabler/icons-react";

interface ProofCustomModalProps {
  error?: string | null;
  isOpen: boolean;
  onClose: () => void;
  customPremise1: string;
  customPremise2: string;
  customPremise3: string;
  customGoal: string;
  setCustomPremise1: (val: string) => void;
  setCustomPremise2: (val: string) => void;
  setCustomPremise3: (val: string) => void;
  setCustomGoal: (val: string) => void;
  onLoadIntoWorkspace: () => void;
}

export const ProofCustomModal: React.FC<ProofCustomModalProps> = ({
  error,
  isOpen,
  onClose,
  customPremise1,
  customPremise2,
  customPremise3,
  customGoal,
  setCustomPremise1,
  setCustomPremise2,
  setCustomPremise3,
  setCustomGoal,
  onLoadIntoWorkspace,
}) => {
  const titleId = useId();
  const premise1Id = useId();
  const premise2Id = useId();
  const premise3Id = useId();
  const goalId = useId();

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      titleId={titleId}
      maxWidth="max-w-lg"
      className="p-4 sm:p-6 gap-4"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3
          id={titleId}
          className="min-w-0 text-lg font-bold text-white flex items-center gap-2"
        >
          <IconPlus className="w-5 h-5 text-brand-purple" />
          Custom Invariant Studio
        </h3>
        <button
          onClick={onClose}
          aria-label="Close Custom Studio Modal"
          className="shrink-0 p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-3 text-xs">
        <div>
          <label
            htmlFor={premise1Id}
            className="block text-slate-400 font-mono mb-1"
          >
            Premise 1 Formula:
          </label>
          <input
            id={premise1Id}
            type="text"
            value={customPremise1}
            onChange={(e) => setCustomPremise1(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-white focus:outline-none focus:border-brand-cyan"
          />
        </div>
        <div>
          <label
            htmlFor={premise2Id}
            className="block text-slate-400 font-mono mb-1"
          >
            Premise 2 Formula:
          </label>
          <input
            id={premise2Id}
            type="text"
            value={customPremise2}
            onChange={(e) => setCustomPremise2(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-white focus:outline-none focus:border-brand-cyan"
          />
        </div>
        <div>
          <label
            htmlFor={premise3Id}
            className="block text-slate-400 font-mono mb-1"
          >
            Premise 3 Formula:
          </label>
          <input
            id={premise3Id}
            type="text"
            value={customPremise3}
            onChange={(e) => setCustomPremise3(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-white focus:outline-none focus:border-brand-cyan"
          />
        </div>
        <div>
          <label
            htmlFor={goalId}
            className="block text-slate-400 font-mono mb-1"
          >
            Target Invariant Goal:
          </label>
          <input
            id={goalId}
            type="text"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-white focus:outline-none focus:border-brand-cyan"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Use three premises and two binary inference steps. Formulas are saved in
        the share URL; anyone with that link can read them. Reopen Custom Studio
        to edit.
      </p>
      {error && (
        <p role="alert" className="text-sm text-amber-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onLoadIntoWorkspace}
          className="px-4 py-2 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer active:scale-[0.98]"
        >
          Load into Workspace
        </button>
      </div>
    </ModalContainer>
  );
};
