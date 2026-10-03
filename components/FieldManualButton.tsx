"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  useSyncExternalStore,
} from "react";
import { IconHelp, IconBook2 } from "@tabler/icons-react";
import { GAME_MANUALS } from "@/lib/game-manuals";
import {
  FieldManualModal,
  type FieldManualAction,
} from "@/components/FieldManualModal";
import { useAudio } from "@/components/providers/AudioProvider";
import { isEditableElement } from "@/hooks/useHotkeys";
import {
  STORAGE_CHANGE_EVENT,
  safeGetItem,
  safeIsAvailable,
  safeSetRawItem,
} from "@/lib/safe-storage";

interface FieldManualButtonProps {
  manualId: string;
  className?: string;
  variant?: "header" | "card" | "inline";
  label?: string;
  onOpenChange?: (isOpen: boolean) => void;
  isHotkeyOwner?: boolean;
  /** A game action offered on the manual's first tab. */
  action?: FieldManualAction;
}

interface ManualInstance {
  id: string;
  manualId: string;
  isHotkeyOwner: boolean;
  isExplicitOwner: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  getIsOpen: () => boolean;
  open: () => void;
  close: () => void;
}

const registeredInstances: ManualInstance[] = [];

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (typeof el.isConnected === "boolean" && !el.isConnected) {
    return false;
  }
  if (typeof el.checkVisibility === "function") {
    try {
      return el.checkVisibility({
        checkOpacity: false,
        checkVisibilityCSS: true,
      });
    } catch {
      return el.checkVisibility();
    }
  }
  if (el.offsetParent !== null) {
    return true;
  }
  // In environments without layout engine or checkVisibility (e.g. unmocked JSDOM),
  // check if element or any ancestor has hidden attribute or inline display: none
  return !el.closest?.(
    '[hidden], [style*="display: none"], [style*="display:none"]'
  );
}

function selectCandidate(pool: ManualInstance[]): ManualInstance | undefined {
  if (pool.length === 0) return undefined;
  return (
    pool.find((inst) => inst.isExplicitOwner) ??
    pool.find((inst) => inst.isHotkeyOwner) ??
    pool[0]
  );
}

function handleGlobalCoordinatorKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (isEditableElement(target)) {
    return;
  }

  const isManualKey =
    e.key === "?" || (e.key === "h" && !e.metaKey && !e.ctrlKey && !e.altKey);

  if (!isManualKey) {
    return;
  }

  // If any instance is currently open, toggle it closed
  const openInstance = registeredInstances.find((inst) => inst.getIsOpen());
  if (openInstance) {
    e.preventDefault();
    openInstance.close();
    return;
  }

  // A game that already handled the key owns it: Quasi-Perfect's H toggles
  // hints, so it must not also open the manual (#1323). ? still opens it.
  if (e.defaultPrevented) {
    return;
  }

  // Filter candidates that allow hotkeys and are not blocked by a foreign keyboard boundary
  const targetBoundary = target?.closest?.("[data-keyboard-boundary]");
  // A game's playfield can name its own manual, so ? opens that manual from
  // the focused board even when its trigger sits outside the boundary or in a
  // collapsed panel (#1669).
  const boundaryManualId =
    targetBoundary?.getAttribute("data-field-manual") || null;
  const isBoundaryManual = (inst: ManualInstance) =>
    boundaryManualId !== null && inst.manualId === boundaryManualId;
  const candidates = registeredInstances.filter((inst) => {
    if (!inst.isHotkeyOwner) return false;
    if (isBoundaryManual(inst)) return true;
    if (targetBoundary) {
      const instBoundary = inst.buttonRef.current?.closest?.(
        "[data-keyboard-boundary]"
      );
      if (instBoundary !== targetBoundary) {
        return false;
      }
    }
    return true;
  });

  if (candidates.length === 0) {
    return;
  }

  // Check visible candidates only: hidden controls cannot capture the shortcut
  const visibleCandidates = candidates.filter(
    (inst) => isBoundaryManual(inst) || isElementVisible(inst.buttonRef.current)
  );

  const targetInstance =
    selectCandidate(visibleCandidates.filter(isBoundaryManual)) ??
    selectCandidate(visibleCandidates);

  if (targetInstance) {
    e.preventDefault();
    targetInstance.open();
  }
}

function registerManualInstance(instance: ManualInstance) {
  registeredInstances.push(instance);
  if (registeredInstances.length === 1 && typeof window !== "undefined") {
    window.addEventListener("keydown", handleGlobalCoordinatorKeyDown);
  }
}

function unregisterManualInstance(id: string) {
  const idx = registeredInstances.findIndex((inst) => inst.id === id);
  if (idx !== -1) {
    registeredInstances.splice(idx, 1);
  }
  if (registeredInstances.length === 0 && typeof window !== "undefined") {
    window.removeEventListener("keydown", handleGlobalCoordinatorKeyDown);
  }
}

function subscribeStorage(callback: () => void) {
  // "storage" covers other tabs; STORAGE_CHANGE_EVENT covers safeStorage
  // writes in this tab, including another instance opening the same manual.
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

export function FieldManualButton({
  manualId,
  className = "",
  variant = "header",
  label = "Field Manual",
  onOpenChange,
  isHotkeyOwner,
  action,
}: FieldManualButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  const onOpenChangeRef = useRef(onOpenChange);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const { playHover } = useAudio();

  const manual = GAME_MANUALS[manualId];

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const open = useCallback(() => {
    if (isOpenRef.current) return;
    isOpenRef.current = true;
    setIsOpen(true);
    onOpenChangeRef.current?.(true);
    // Bare "true" (no envelope) so visitors who already opened a manual keep
    // that state. safeSetRawItem never throws and notifies subscribers.
    safeSetRawItem(`seen_manual_${manualId}`, "true");
  }, [manualId]);

  const close = useCallback(() => {
    if (!isOpenRef.current) return;
    isOpenRef.current = false;
    setIsOpen(false);
    onOpenChangeRef.current?.(false);
  }, []);

  useEffect(() => {
    const isExplicitOwner = isHotkeyOwner === true;
    const effectiveOwner =
      isHotkeyOwner !== undefined ? isHotkeyOwner : variant !== "card";

    const instance: ManualInstance = {
      id,
      manualId,
      isHotkeyOwner: effectiveOwner,
      isExplicitOwner,
      buttonRef,
      getIsOpen: () => isOpenRef.current,
      open,
      close,
    };

    registerManualInstance(instance);
    return () => {
      if (isOpenRef.current) {
        onOpenChangeRef.current?.(false);
      }
      unregisterManualInstance(id);
    };
  }, [id, manualId, isHotkeyOwner, variant, open, close]);

  // Client-safe localStorage read with useSyncExternalStore
  const hasSeenGuide = useSyncExternalStore(
    subscribeStorage,
    () => {
      if (typeof window === "undefined" || !manualId) return true;
      // Without storage the "new" hint could never be dismissed for good, so
      // it stays hidden, as it did before.
      if (!safeIsAvailable()) return true;
      // The stored string "true" parses to the boolean true.
      return safeGetItem<boolean>(`seen_manual_${manualId}`) === true;
    },
    () => true
  );

  const handleOpen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    open();
  };

  const handleClose = () => {
    close();
  };

  if (!manual) return null;

  if (variant === "card") {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          onMouseEnter={() => playHover()}
          aria-label={`Open Field Manual for ${manual.title}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-xl text-xs font-mono font-medium text-zinc-300 hover:text-[var(--game-accent,#67e8f9)] bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${className}`}
        >
          <IconHelp className="w-3.5 h-3.5 text-[var(--game-accent,#22d3ee)]" />
          <span>Manual</span>
        </button>

        <FieldManualModal
          isOpen={isOpen}
          onClose={handleClose}
          manual={manual}
          action={action}
        />
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          onMouseEnter={() => playHover()}
          aria-label={`Open Field Manual for ${manual.title}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 min-h-[44px] min-w-[44px] text-xs font-mono font-semibold rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-[var(--game-accent,#22d3ee)] border border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${className}`}
        >
          <IconBook2 className="w-4 h-4 text-[var(--game-accent,#22d3ee)]" />
          <span>{label}</span>
          <kbd className="text-[10px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
            ?
          </kbd>
        </button>

        <FieldManualModal
          isOpen={isOpen}
          onClose={handleClose}
          manual={manual}
          action={action}
        />
      </>
    );
  }

  // Header default variant
  return (
    <>
      <div className="relative inline-flex items-center">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          onMouseEnter={() => playHover()}
          aria-label={`Open Field Manual for ${manual.title}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`group flex items-center justify-center gap-2 px-3.5 py-1.5 min-h-[44px] min-w-[44px] text-xs font-mono font-bold rounded-xl transition-all border cursor-pointer touch-manipulation select-none active:scale-95 ${
            !hasSeenGuide
              ? "bg-zinc-900/80 text-[var(--game-accent,#67e8f9)] border-[color:var(--game-accent,#06b6d4)]"
              : "bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 hover:text-[var(--game-accent,#67e8f9)] border-zinc-800 hover:border-zinc-600"
          } ${className}`}
        >
          <IconHelp className="w-4 h-4 text-[var(--game-accent,#22d3ee)] group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">{label}</span>
          <kbd className="hidden sm:inline-block text-[10px] text-zinc-400 group-hover:text-zinc-300 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
            ?
          </kbd>
        </button>

        {!hasSeenGuide && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping-settle absolute inline-flex h-full w-full rounded-full bg-[var(--game-accent,#22d3ee)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--game-accent,#06b6d4)]"></span>
          </span>
        )}
      </div>

      <FieldManualModal
        isOpen={isOpen}
        onClose={handleClose}
        manual={manual}
        action={action}
      />
    </>
  );
}
