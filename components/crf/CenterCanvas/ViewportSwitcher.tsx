"use client";

import React from "react";
import {
  IconDeviceDesktop,
  IconDeviceTablet,
  IconDeviceMobile,
} from "@tabler/icons-react";
import { DeviceViewport } from "@/lib/crf/types";

import { TooltipButton } from "@/components/ui/Tooltip";
interface ViewportSwitcherProps {
  viewport: DeviceViewport;
  onChangeViewport: (vp: DeviceViewport) => void;
  gridCols: number;
}

export const ViewportSwitcher: React.FC<ViewportSwitcherProps> = ({
  viewport,
  onChangeViewport,
}) => {
  return (
    <div className="flex items-center gap-1 studio-surface-card border studio-border-default p-1 rounded-xl shadow-inner">
      <TooltipButton
        onClick={() => onChangeViewport("desktop")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
          viewport === "desktop"
            ? "studio-surface-muted studio-fg-primary font-bold shadow-sm"
            : "studio-fg-muted studio-hover-fg-primary"
        } pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center`}
        tooltip="Desktop 12-Column Responsive View"
        aria-label="Desktop 12-Column Responsive View"
      >
        <IconDeviceDesktop className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Desktop</span>
      </TooltipButton>

      <TooltipButton
        onClick={() => onChangeViewport("tablet")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
          viewport === "tablet"
            ? "studio-surface-muted studio-fg-primary font-bold shadow-sm"
            : "studio-fg-muted studio-hover-fg-primary"
        } pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center`}
        tooltip="Tablet 768px Form Factor"
        aria-label="Tablet 768px Form Factor"
      >
        <IconDeviceTablet className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Tablet</span>
      </TooltipButton>

      <TooltipButton
        onClick={() => onChangeViewport("mobile")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
          viewport === "mobile"
            ? "studio-surface-muted studio-fg-primary font-bold shadow-sm"
            : "studio-fg-muted studio-hover-fg-primary"
        } pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center`}
        tooltip="ePRO Mobile Patient Device Preview"
        aria-label="ePRO Mobile Patient Device Preview"
      >
        <IconDeviceMobile className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Mobile</span>
      </TooltipButton>
    </div>
  );
};
