"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  progressBus,
  formatBytes,
  AssetProgressEvent,
} from "@/lib/neuro/progress-bus";
import {
  Icon3dCubeSphere,
  IconCheck,
  IconAlertTriangle,
  IconLoader2,
} from "@tabler/icons-react";

interface ProgressHUDProps {
  className?: string;
}

export const ProgressHUD: React.FC<ProgressHUDProps> = ({ className = "" }) => {
  const [event, setEvent] = useState<AssetProgressEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = progressBus.subscribe((newEvent) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      setEvent(newEvent);

      if (newEvent.status === "loading") {
        setVisible(true);
        setIsFadingOut(false);
      } else if (
        newEvent.status === "complete" ||
        newEvent.status === "error"
      ) {
        setVisible(true);
        setIsFadingOut(true);
        dismissTimerRef.current = setTimeout(() => {
          setVisible(false);
          setIsFadingOut(false);
          dismissTimerRef.current = null;
        }, 300);
      }
    });

    return () => {
      unsubscribe();
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  if (!visible || !event) return null;

  const filename = event.url.split("/").pop() || event.url;
  const isComplete = event.status === "complete";
  const isError = event.status === "error";

  const loadedStr = formatBytes(event.loaded);
  const totalStr = event.total > 0 ? formatBytes(event.total) : null;
  const byteCountDisplay = totalStr ? `${loadedStr} / ${totalStr}` : loadedStr;

  return (
    <div
      data-testid="progress-hud-container"
      className={`pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-2 bg-zinc-950/90 backdrop-blur-md border border-zinc-700/80 px-4 py-3 rounded-2xl shadow-2xl text-xs font-mono text-zinc-200 min-w-[280px] sm:min-w-[320px] transition-all duration-300 origin-bottom ${
        isFadingOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden">
          {isError ? (
            <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : isComplete ? (
            <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <IconLoader2 className="w-4 h-4 text-brand-cyan animate-spin shrink-0" />
          )}
          <span className="font-semibold text-white truncate" title={filename}>
            {isError
              ? "Fetch Failed (Procedural Fallback)"
              : isComplete
                ? "Asset Ready"
                : filename}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-zinc-400 font-bold">
            {event.percentage}%
          </span>
        </div>
      </div>

      {/* Hardware-Accelerated Progress Bar Track */}
      <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden relative border border-zinc-700/50">
        <div
          data-testid="progress-bar-fill"
          className={`h-full rounded-full transition-transform duration-100 ease-out origin-left will-change-transform ${
            isError
              ? "bg-amber-500"
              : isComplete
                ? "bg-emerald-400"
                : "bg-brand-cyan"
          }`}
          style={{
            // eslint-disable-next-line no-restricted-syntax -- #1119: file has open-PR/branch changes in flight; swap to clamp() after they land
            transform: `scaleX(${Math.max(0, Math.min(1, event.percentage / 100))})`,
            transformOrigin: "left",
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-400">
        <span className="flex items-center gap-1">
          <Icon3dCubeSphere className="w-3 h-3 text-zinc-500" />
          <span>{byteCountDisplay}</span>
        </span>
        <span>
          {isError
            ? "Fallback Active"
            : isComplete
              ? "100% Downloaded"
              : "Transferring Data..."}
        </span>
      </div>
    </div>
  );
};
