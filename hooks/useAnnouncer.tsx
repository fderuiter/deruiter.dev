"use client";

export {
  useAnnouncer,
  A11yProvider as LiveAnnouncerProvider,
  sanitizePII,
  initialAnnouncerState,
  liveAnnouncer,
  LiveAnnouncer,
  type Priority,
  type Priority as AnnouncementMode,
  type AnnouncerContextType,
  type AnnounceItem,
  type AnnouncerState,
  type A11yProviderProps,
} from "@/components/providers/A11yProvider";
