"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { liveAnnouncer, type Priority } from "@/lib/a11y/announcer";

/** Visual and semantic category of a toast notification. */
export type ToastVariant = "success" | "error" | "info" | "warning";

/** Per-call options accepted by the toast methods. */
export interface ToastOptions {
  /** Optional secondary line rendered beneath the message. */
  description?: string;
  /**
   * Auto-dismiss delay in milliseconds. Defaults to 4000ms (6000ms for errors).
   * Pass `Infinity` or `0` to keep the toast until the user dismisses it.
   */
  duration?: number;
}

/** A toast currently held in the provider's visible stack. */
export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  description?: string;
  duration: number;
}

/** Imperative toast API returned by `useToast`. */
export interface ToastApi {
  /** Enqueues a toast of the given variant and returns its id. */
  show: (
    variant: ToastVariant,
    message: string,
    options?: ToastOptions
  ) => string;
  /** Enqueues a success toast (announced politely). */
  success: (message: string, options?: ToastOptions) => string;
  /** Enqueues an error toast (announced assertively). */
  error: (message: string, options?: ToastOptions) => string;
  /** Enqueues an informational toast (announced politely). */
  info: (message: string, options?: ToastOptions) => string;
  /** Enqueues a warning toast (announced politely). */
  warning: (message: string, options?: ToastOptions) => string;
  /** Removes a toast by id, or every visible toast when no id is given. */
  dismiss: (id?: string) => void;
}

/** Props for the global toast provider. */
export interface ToastProviderProps {
  children: React.ReactNode;
  /** Maximum number of simultaneously visible toasts; the oldest is evicted first. Defaults to 3. */
  maxVisible?: number;
}

/** Maximum simultaneously visible toasts when no override is given. */
export const DEFAULT_MAX_TOASTS = 3;
const DEFAULT_DURATION_MS = 4000;
const DEFAULT_ERROR_DURATION_MS = 6000;

const ToastContext = createContext<ToastApi | null>(null);

let nextToastId = 0;
function createToastId(): string {
  nextToastId += 1;
  return `toast-${nextToastId}`;
}

function priorityFor(variant: ToastVariant): Priority {
  return variant === "error" ? "assertive" : "polite";
}

function resolveDuration(variant: ToastVariant, duration?: number): number {
  if (duration === undefined) {
    return variant === "error"
      ? DEFAULT_ERROR_DURATION_MS
      : DEFAULT_DURATION_MS;
  }
  if (!Number.isFinite(duration) || duration <= 0) return Infinity;
  return duration;
}

function composeAnnouncement(message: string, description?: string): string {
  return description ? `${message}. ${description}` : message;
}

/**
 * Standalone fallback used when no provider is mounted: toasts are not drawn,
 * but the message still reaches screen readers through the shared announcer.
 */
const fallbackApi: ToastApi = (() => {
  const show = (
    variant: ToastVariant,
    message: string,
    options?: ToastOptions
  ) => {
    liveAnnouncer.announce(
      composeAnnouncement(message, options?.description),
      priorityFor(variant)
    );
    return createToastId();
  };
  return {
    show,
    success: (message, options) => show("success", message, options),
    error: (message, options) => show("error", message, options),
    info: (message, options) => show("info", message, options),
    warning: (message, options) => show("warning", message, options),
    dismiss: () => {},
  };
})();

/**
 * Returns the global toast API. Outside a ToastProvider the returned API only
 * announces messages to assistive technology and draws nothing.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? fallbackApi;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    accent: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    label: string;
  }
> = {
  success: {
    accent: "text-emerald-500",
    icon: IconCircleCheck,
    label: "Success",
  },
  error: { accent: "text-red-400", icon: IconCircleX, label: "Error" },
  info: { accent: "text-slate-400", icon: IconInfoCircle, label: "Info" },
  warning: {
    accent: "text-amber-500",
    icon: IconAlertTriangle,
    label: "Warning",
  },
};

const ACCENT_BAR: Record<ToastVariant, string> = {
  success: "bg-emerald-500",
  error: "bg-red-400",
  info: "bg-slate-400",
  warning: "bg-amber-500",
};

interface TimerEntry {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

/**
 * Global toast notification provider. Renders a single stacked viewport
 * docked bottom-right on desktop and full-width at the bottom on mobile.
 * Every toast is announced once through the shared LiveAnnouncer; the
 * visual stack deliberately carries no live region so speech is not doubled.
 */
export function ToastProvider({
  children,
  maxVisible = DEFAULT_MAX_TOASTS,
}: ToastProviderProps) {
  const { announce } = useAnnouncer();
  const reduceMotion = useReducedMotion();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  const timersRef = useRef<Map<string, TimerEntry>>(new Map());
  const pausedRef = useRef(false);

  const commit = useCallback((next: ToastItem[]) => {
    toastsRef.current = next;
    // A toast removed from under the pointer never fires mouseleave, so an
    // empty stack must not leave later toasts stuck in the paused state.
    if (next.length === 0) pausedRef.current = false;
    setToasts(next);
  }, []);

  const clearTimer = useCallback((id: string) => {
    const entry = timersRef.current.get(id);
    if (entry?.handle) clearTimeout(entry.handle);
    timersRef.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id?: string) => {
      if (id === undefined) {
        for (const toastId of Array.from(timersRef.current.keys()))
          clearTimer(toastId);
        commit([]);
        return;
      }
      clearTimer(id);
      if (toastsRef.current.some((t) => t.id === id)) {
        commit(toastsRef.current.filter((t) => t.id !== id));
      }
    },
    [clearTimer, commit]
  );

  const armTimer = useCallback(
    (id: string, ms: number) => {
      if (!Number.isFinite(ms)) return;
      const entry: TimerEntry = {
        handle: null,
        remaining: ms,
        startedAt: Date.now(),
      };
      if (!pausedRef.current) {
        entry.handle = setTimeout(() => dismiss(id), ms);
      }
      timersRef.current.set(id, entry);
    },
    [dismiss]
  );

  const pauseTimers = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    const now = Date.now();
    timersRef.current.forEach((entry) => {
      if (entry.handle) {
        clearTimeout(entry.handle);
        entry.handle = null;
        entry.remaining = Math.max(
          0,
          entry.remaining - (now - entry.startedAt)
        );
      }
    });
  }, []);

  const resumeTimers = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    const now = Date.now();
    timersRef.current.forEach((entry, id) => {
      entry.startedAt = now;
      entry.handle = setTimeout(() => dismiss(id), entry.remaining);
    });
  }, [dismiss]);

  const show = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id = createToastId();
      const item: ToastItem = {
        id,
        variant,
        message,
        description: options?.description,
        duration: resolveDuration(variant, options?.duration),
      };
      const limit = Math.max(1, maxVisible);
      const next = [...toastsRef.current, item];
      while (next.length > limit) {
        const evicted = next.shift();
        if (evicted) clearTimer(evicted.id);
      }
      commit(next);
      armTimer(id, item.duration);
      announce(
        composeAnnouncement(message, item.description),
        priorityFor(variant)
      );
      return id;
    },
    [announce, armTimer, clearTimer, commit, maxVisible]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((entry) => {
        if (entry.handle) clearTimeout(entry.handle);
      });
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => show("success", message, options),
      error: (message, options) => show("error", message, options),
      info: (message, options) => show("info", message, options),
      warning: (message, options) => show("warning", message, options),
      dismiss,
    }),
    [show, dismiss]
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        resumeTimers();
    },
    [resumeTimers]
  );

  const offset = reduceMotion ? 0 : 12;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        data-testid="toast-viewport"
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-stretch sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 sm:items-end"
        onMouseEnter={pauseTimers}
        onMouseLeave={resumeTimers}
        onFocus={pauseTimers}
        onBlur={handleBlur}
      >
        <ol aria-label="Notifications" className="flex w-full flex-col gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((t) => {
              const style = VARIANT_STYLES[t.variant];
              const Icon = style.icon;
              return (
                <motion.li
                  key={t.id}
                  layout={!reduceMotion}
                  initial={{ opacity: 0, y: offset }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: offset }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.18,
                    ease: "easeOut",
                  }}
                  data-testid="toast"
                  data-variant={t.variant}
                  className="pointer-events-auto relative flex w-full min-w-0 items-start gap-3 overflow-hidden rounded-lg border border-white/[0.08] bg-[#13151a] py-3 pr-2 pl-4 text-[#f4f4f6] shadow-lg shadow-black/40"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-0.5 ${ACCENT_BAR[t.variant]}`}
                  />
                  <Icon
                    aria-hidden
                    className={`mt-0.5 h-4 w-4 shrink-0 ${style.accent}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="sr-only">{style.label}:</p>
                    <p className="text-sm leading-snug break-words">
                      {t.message}
                    </p>
                    {t.description && (
                      <p className="mt-1 text-xs leading-snug break-words text-zinc-400">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="-my-1 shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 active:scale-[0.98]"
                  >
                    <IconX aria-hidden className="h-4 w-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </div>
    </ToastContext.Provider>
  );
}
