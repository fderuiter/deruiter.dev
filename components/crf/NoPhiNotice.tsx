import React from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

interface NoPhiNoticeProps {
  className?: string;
}

/**
 * Tells visitors not to type or upload real patient data. CRF Studio is a
 * synthetic demo with no access controls, so anything entered here must be
 * made up.
 */
export const NoPhiNotice: React.FC<NoPhiNoticeProps> = ({ className = "" }) => (
  <p
    role="note"
    data-testid="no-phi-notice"
    className={`flex min-w-0 items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs font-sans leading-snug text-amber-200 break-words ${className}`}
  >
    <IconAlertTriangle
      className="mt-px h-4 w-4 shrink-0 text-amber-400"
      aria-hidden="true"
    />
    <span className="min-w-0">
      Synthetic demo only. Do not enter or upload real patient data or other
      personal health information. Nothing here is a validated system.
    </span>
  </p>
);
