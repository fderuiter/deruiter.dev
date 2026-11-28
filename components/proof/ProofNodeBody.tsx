"use client";

import React, { useCallback, useId } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  evaluateAst,
  type FallacyDiagnosis,
  type ProofNode,
} from "@/lib/proof";

interface ProofNodeBodyProps {
  variant: "flow" | "stack";
  node: ProofNode;
  isSelected: boolean;
  isGivenPremise: boolean;
  isNodeProven: boolean;
  isFallacyTargetNode: boolean;
  currentFallacy: FallacyDiagnosis | null;
  hasCommittedFallacyEdge: boolean;
  isPopoverOpen: boolean;
  isSandbox: boolean;
  isEditing: boolean;
  editingFormula: string;
  editingError: string | null;
  canEditSandboxNode: boolean;
  onNodeClick: (nodeId: string, addToSelection?: boolean) => void;
  onTogglePopover: (nodeId: string) => void;
  onClosePopover: (nodeId: string, restoreFocus?: boolean) => void;
  onRegisterPopoverToggle?: (
    nodeId: string,
    element: HTMLButtonElement | null
  ) => void;
  onBeginEdit: (nodeId: string, currentLabel: string) => void;
  onChangeEditingFormula: (value: string) => void;
  onSubmitEdit: (e: React.FormEvent, nodeId: string) => void;
  onCancelEdit: () => void;
  onDeleteSandboxNode?: (nodeId: string) => void;
  onRollback?: () => void;
  onInspectFallacy?: () => void;
  trailingAction?: React.ReactNode;
  afterMainContent?: React.ReactNode;
}

export function ProofNodeBody({
  variant,
  node,
  isSelected,
  isGivenPremise,
  isNodeProven,
  isFallacyTargetNode,
  currentFallacy,
  hasCommittedFallacyEdge,
  isPopoverOpen,
  isSandbox,
  isEditing,
  editingFormula,
  editingError,
  canEditSandboxNode,
  onNodeClick,
  onTogglePopover,
  onClosePopover,
  onRegisterPopoverToggle,
  onBeginEdit,
  onChangeEditingFormula,
  onSubmitEdit,
  onCancelEdit,
  onDeleteSandboxNode,
  onRollback,
  onInspectFallacy,
  trailingAction,
  afterMainContent,
}: ProofNodeBodyProps) {
  const reactId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const panelId = `proof-counterexample-${variant}-${node.id}-${reactId}`;
  const isFlow = variant === "flow";
  const isConclusion = node.type === "conclusion";
  const statusText = isGivenPremise
    ? "GIVEN"
    : isNodeProven
      ? "PROVEN"
      : "PENDING";

  const handleToggleRef = useCallback(
    (el: HTMLButtonElement | null) => {
      onRegisterPopoverToggle?.(node.id, el);
    },
    [node.id, onRegisterPopoverToggle]
  );

  const mainNodeButton = (
    <button
      type="button"
      tabIndex={0}
      data-proof-node-id={node.id}
      aria-pressed={isSelected}
      aria-describedby="proof-node-keyboard-help"
      onClick={(event) => onNodeClick(node.id, event.shiftKey)}
      onKeyDown={(event) => {
        if (event.shiftKey && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onNodeClick(node.id, true);
        }
      }}
      className={
        isFlow
          ? "block w-full min-h-[44px] min-w-0 pr-5 text-left rounded-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
          : "flex-1 min-w-0 min-h-11 text-left rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      }
    >
      {isFlow ? (
        <>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] leading-tight font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-200">
              Node {node.id}
            </span>{" "}
            <span
              className={`text-[9px] leading-tight font-mono font-bold px-1.5 py-0.5 rounded ${
                isGivenPremise
                  ? "bg-slate-800 text-sky-300 border border-slate-600/50"
                  : isNodeProven
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700/50"
                    : "bg-amber-950 text-amber-300 border border-amber-700/50"
              }`}
            >
              {statusText}
            </span>
          </div>{" "}
          <div className="min-w-0 break-words font-mono text-[13px] leading-snug font-bold text-white mb-0.5">
            {node.label}
          </div>{" "}
          <div className="text-[10px] leading-tight text-slate-300 line-clamp-2">
            {node.meaning}
          </div>
          <span className="sr-only"> {node.type}</span>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className={`text-xs font-mono font-bold ${
                isConclusion && !isNodeProven
                  ? "text-amber-300"
                  : isNodeProven && !isGivenPremise
                    ? "text-emerald-300"
                    : "text-slate-200"
              }`}
            >
              Node {node.id}
            </span>{" "}
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isGivenPremise
                  ? "bg-slate-800 text-sky-300 border-slate-700"
                  : isNodeProven
                    ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-950 text-amber-300 border-amber-500/40"
              }`}
            >
              {statusText}
            </span>
            {isConclusion && (
              <>
                {" "}
                <span className="text-[10px] font-mono text-amber-300">
                  Proof Target
                </span>
              </>
            )}
          </div>{" "}
          <div
            className={`w-full min-w-0 break-words font-mono text-base font-extrabold tracking-wide ${
              isConclusion && !isNodeProven
                ? "text-amber-300"
                : isNodeProven && !isGivenPremise
                  ? "text-emerald-300"
                  : "text-cyan-300"
            }`}
          >
            {node.label}
          </div>{" "}
          <p className="text-xs text-slate-300 leading-snug mt-1 break-words">
            {node.meaning}
          </p>
          <span className="sr-only"> {node.type}</span>
        </>
      )}
    </button>
  );

  const counterexamplePanel = isPopoverOpen && currentFallacy && (
    <div
      id={panelId}
      role="region"
      aria-label={`Counterexample diagnostics for Node ${node.id}`}
      className={
        isFlow
          ? "nodrag nopan absolute top-full mt-2 left-0 w-[268px] p-3 rounded-xl bg-slate-950/95 border border-rose-500/60 shadow-2xl shadow-rose-950/80 backdrop-blur z-50 text-xs text-slate-200 pointer-events-auto"
          : "w-full p-3 rounded-xl bg-slate-950/95 border border-rose-500/60 text-xs text-slate-200 space-y-2"
      }
      onPointerDown={isFlow ? (e) => e.stopPropagation() : undefined}
      onClick={isFlow ? (e) => e.stopPropagation() : undefined}
    >
      <div
        className={`flex items-start justify-between border-b border-slate-800 pb-2 ${
          isFlow ? "mb-2" : "gap-2"
        }`}
      >
        <div className={isFlow ? "min-w-0 pr-2" : "min-w-0"}>
          <div
            className={
              isFlow
                ? "font-mono font-bold text-rose-300 text-[11px] uppercase tracking-wide flex items-center gap-1"
                : "font-mono font-bold text-rose-300 text-xs break-words"
            }
          >
            {isFlow && (
              <IconAlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            )}
            <span className={isFlow ? "truncate" : undefined}>
              {currentFallacy.fallacyName}
            </span>
          </div>
          <div
            className={`font-mono ${
              isFlow ? "text-[10px]" : "text-[11px]"
            } text-slate-300 break-words`}
          >
            {currentFallacy.formalFormula}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClosePopover(node.id, true);
          }}
          aria-label="Close counterexample panel"
          className={
            isFlow
              ? "p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              : "min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          }
        >
          <IconX className={isFlow ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </button>
      </div>

      {currentFallacy.counterexampleValuation && (
        <div className={isFlow ? "mb-2" : undefined}>
          {isFlow && (
            <div className="text-[10px] font-mono font-semibold text-amber-300 mb-1 uppercase tracking-wider">
              Counterexample Valuation:
            </div>
          )}
          <div
            className={`flex flex-wrap gap-1.5 font-mono ${
              isFlow ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {Object.entries(currentFallacy.counterexampleValuation).map(
              ([varName, val]) => (
                <span
                  key={varName}
                  className={`${
                    isFlow ? "px-1.5" : "px-2"
                  } py-0.5 rounded border font-bold ${
                    val
                      ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                      : "bg-rose-950/80 border-rose-500/50 text-rose-300"
                  }`}
                >
                  {varName} = {val ? "TRUE (1)" : "FALSE (0)"}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {currentFallacy.premises && currentFallacy.premises.length > 0 && (
        <div className={isFlow ? "mb-2" : undefined}>
          {isFlow && (
            <div className="text-[10px] font-mono font-semibold text-slate-300 mb-1 uppercase tracking-wider">
              AST Sub-Expression Evaluations:
            </div>
          )}
          <div
            className={`space-y-1 font-mono ${
              isFlow ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {currentFallacy.premises.map((p, idx) => {
              const evalVal = currentFallacy.counterexampleValuation
                ? evaluateAst(p.ast, currentFallacy.counterexampleValuation)
                : true;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between bg-slate-900/80 ${
                    isFlow ? "p-1" : "gap-2 p-1.5 min-w-0"
                  } rounded border border-slate-800`}
                >
                  <span
                    className={
                      isFlow
                        ? "text-slate-200 truncate max-w-[175px]"
                        : "text-slate-200 break-words min-w-0"
                    }
                  >
                    {p.label}
                  </span>
                  <span
                    className={`${
                      isFlow
                        ? "px-1 text-[9px]"
                        : "px-1.5 py-0.5 text-[10px] shrink-0"
                    } rounded font-bold ${
                      evalVal
                        ? "bg-emerald-900/60 text-emerald-300"
                        : "bg-rose-900/60 text-rose-300"
                    }`}
                  >
                    {evalVal ? "T" : "F"}
                  </span>
                </div>
              );
            })}
            {currentFallacy.conclusion &&
              (() => {
                const conclEval = currentFallacy.counterexampleValuation
                  ? evaluateAst(
                      currentFallacy.conclusion.ast,
                      currentFallacy.counterexampleValuation
                    )
                  : false;
                return (
                  <div
                    className={`flex items-center justify-between bg-rose-950/40 ${
                      isFlow ? "p-1" : "gap-2 p-1.5 min-w-0"
                    } rounded border border-rose-800/50`}
                  >
                    <span
                      className={
                        isFlow
                          ? "text-rose-200 truncate max-w-[175px]"
                          : "text-rose-200 break-words min-w-0"
                      }
                    >
                      {currentFallacy.conclusion.label}
                    </span>
                    <span
                      className={`${
                        isFlow
                          ? "px-1 text-[9px]"
                          : "px-1.5 py-0.5 text-[10px] shrink-0"
                      } rounded font-bold ${
                        conclEval
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-rose-900/60 text-rose-300"
                      }`}
                    >
                      {conclEval ? "T" : "F"}
                    </span>
                  </div>
                );
              })()}
          </div>
        </div>
      )}

      <div
        className={
          isFlow
            ? "text-[10px] text-slate-300 line-clamp-2 border-t border-slate-800/80 pt-1.5"
            : "text-[11px] text-slate-300 leading-relaxed"
        }
      >
        {currentFallacy.plainEnglish}
      </div>

      {(onRollback || onInspectFallacy) && (
        <div
          className={
            isFlow
              ? "mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2"
              : "flex flex-wrap items-center justify-end gap-2 pt-1"
          }
        >
          {onInspectFallacy && (
            <button
              type="button"
              onClick={() => {
                onClosePopover(node.id, false);
                onInspectFallacy();
              }}
              className={
                isFlow
                  ? "px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono text-[10px] cursor-pointer"
                  : "min-h-11 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 font-mono text-xs cursor-pointer"
              }
            >
              {isFlow ? "Truth Table" : "Open Truth Table"}
            </button>
          )}
          {onRollback && (
            <button
              type="button"
              onClick={() => {
                onClosePopover(node.id, false);
                onRollback();
              }}
              className={
                isFlow
                  ? "px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-mono font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                  : "min-h-11 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-mono font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              }
            >
              <IconRefresh className={isFlow ? "w-3 h-3" : "w-3.5 h-3.5"} />
              <span>
                {hasCommittedFallacyEdge ? "Revert Edge" : "Dismiss Fallacy"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {isEditing && isSandbox ? (
        <form
          onSubmit={(e) => onSubmitEdit(e, node.id)}
          onPointerDown={isFlow ? (e) => e.stopPropagation() : undefined}
          onClick={isFlow ? (e) => e.stopPropagation() : undefined}
          className={isFlow ? "nodrag nopan space-y-1.5 pr-2" : "space-y-2"}
        >
          <div
            className={`${
              isFlow ? "text-[10px]" : "text-xs"
            } font-mono font-bold text-brand-cyan`}
          >
            Edit Node {node.id}
          </div>
          <input
            type="text"
            value={editingFormula}
            onChange={(e) => onChangeEditingFormula(e.target.value)}
            aria-label={`Edit formula for Node ${node.id}`}
            autoFocus
            className={
              isFlow
                ? "w-full min-w-0 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[12px] font-mono text-white focus:outline-none focus:border-brand-cyan"
                : "w-full min-w-0 min-h-11 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-brand-cyan"
            }
          />
          {editingError && (
            <p
              role="alert"
              className={`${
                isFlow ? "text-[10px]" : "text-xs"
              } font-mono text-rose-300`}
            >
              {editingError}
            </p>
          )}
          <div className={`flex items-center ${isFlow ? "gap-1.5" : "gap-2"}`}>
            <button
              type="submit"
              aria-label={`Save Node ${node.id}`}
              className={
                isFlow
                  ? "px-2 py-1 rounded bg-brand-cyan text-slate-950 text-[10px] font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
                  : "min-h-11 px-3 py-2 rounded-lg bg-brand-cyan text-slate-950 text-xs font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
              }
            >
              <IconCheck className={isFlow ? "w-3 h-3" : "w-3.5 h-3.5"} />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              aria-label={`Cancel editing Node ${node.id}`}
              className={
                isFlow
                  ? "px-2 py-1 rounded bg-slate-800 text-slate-200 text-[10px] font-mono cursor-pointer"
                  : "min-h-11 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-mono cursor-pointer"
              }
            >
              Cancel
            </button>
          </div>
        </form>
      ) : trailingAction ? (
        <div className="flex items-start justify-between gap-2.5 min-w-0">
          {mainNodeButton}
          {trailingAction}
        </div>
      ) : (
        mainNodeButton
      )}

      {afterMainContent}

      {/* Counterexample Disclosure Toggle + Inline Panel */}
      {isFallacyTargetNode &&
        currentFallacy &&
        (isFlow ? (
          <>
            <button
              ref={handleToggleRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePopover(node.id);
              }}
              aria-expanded={isPopoverOpen}
              aria-controls={panelId}
              className="nodrag nopan absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-rose-700 hover:bg-rose-600 text-white font-mono text-[9px] font-bold shadow-md shadow-rose-950/80 flex items-center gap-1 z-30 whitespace-nowrap cursor-pointer transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <IconAlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-300 motion-safe:animate-pulse" />
              <span>Counterexample</span>
              <span className="sr-only">
                {" "}
                badge for Node {node.id}. Click to view variable valuations.
              </span>
            </button>
            {counterexamplePanel}
          </>
        ) : (
          <div className="mt-2.5 pt-2 border-t border-rose-500/40 space-y-2">
            <button
              ref={handleToggleRef}
              type="button"
              onClick={() => onTogglePopover(node.id)}
              aria-expanded={isPopoverOpen}
              aria-controls={panelId}
              className="w-full min-h-11 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-mono text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
                <span className="truncate">Counterexample</span>
              </span>{" "}
              <span className="text-[10px] uppercase tracking-wider text-rose-100 shrink-0">
                {isPopoverOpen ? "Hide valuations" : "Inspect valuations"}
              </span>
              <span className="sr-only"> badge for Node {node.id}</span>
            </button>
            {counterexamplePanel}
          </div>
        ))}

      {/* Sandbox Node Edit / Delete Actions */}
      {isSandbox && !isEditing && (
        <div
          onPointerDown={isFlow ? (e) => e.stopPropagation() : undefined}
          onClick={isFlow ? (e) => e.stopPropagation() : undefined}
          className={
            isFlow
              ? "nodrag nopan mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-end gap-1 pr-3"
              : "mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2"
          }
        >
          {canEditSandboxNode && (
            <button
              type="button"
              onClick={() => onBeginEdit(node.id, node.label)}
              aria-label={`Edit Node ${node.id}`}
              className={
                isFlow
                  ? "p-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded text-slate-300 hover:text-brand-cyan hover:bg-slate-800 transition cursor-pointer"
                  : "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-brand-cyan hover:bg-slate-800 transition cursor-pointer"
              }
            >
              <IconPencil className={isFlow ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </button>
          )}
          {onDeleteSandboxNode && (
            <button
              type="button"
              onClick={() => onDeleteSandboxNode(node.id)}
              aria-label={`Delete Node ${node.id}`}
              className={
                isFlow
                  ? "p-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded text-slate-300 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                  : "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
              }
            >
              <IconTrash className={isFlow ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
