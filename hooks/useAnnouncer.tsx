"use client";

export {
  useAnnouncer,
  useOptionalAnnouncer,
  A11yProvider as LiveAnnouncerProvider,
  sanitizePII,
  initialAnnouncerState,
  liveAnnouncer,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";
export type {
  Priority,
  Priority as AnnouncementMode,
  AnnouncerContextType,
  AnnounceItem,
  AnnouncerState,
  A11yProviderProps,
} from "@/components/providers/A11yProvider";
