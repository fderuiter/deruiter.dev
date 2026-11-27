import type {
  BroadcastChannelLike,
  StudyRepositorySyncEvent,
  StudyRepositorySyncHandle,
} from "../types";

/** Default `BroadcastChannel` name shared by all clinical studio routes. */
export const STUDY_REPOSITORY_CHANNEL_NAME = "clinical_study_repository_v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSyncEvent(value: unknown): value is StudyRepositorySyncEvent {
  if (!isRecord(value)) return false;
  if (typeof value.tabId !== "string" || typeof value.updatedAt !== "string") {
    return false;
  }
  switch (value.type) {
    case "active-study-changed":
      return value.studyId === null || typeof value.studyId === "string";
    case "study-saved":
      return (
        typeof value.studyId === "string" &&
        typeof value.revisionId === "string" &&
        typeof value.sha256 === "string"
      );
    case "study-imported":
      return (
        typeof value.studyId === "string" &&
        typeof value.revisionId === "string"
      );
    case "study-deleted":
      return (
        typeof value.studyId === "string" &&
        (value.nextActiveStudyId === null ||
          typeof value.nextActiveStudyId === "string")
      );
    default:
      return false;
  }
}

function makeDefaultTabId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultChannelFactory(name: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}

/**
 * Opens a `BroadcastChannel` handle for synchronizing active study switches,
 * imports, deletions, and committed revisions across open browser tabs.
 * Ignores events sent by the same `tabId` and falls back to a safe no-op
 * handle when `BroadcastChannel` is unavailable.
 */
export function openStudyRepositorySync(
  options: {
    readonly channelName?: string;
    readonly tabId?: string;
    readonly createChannel?: (name: string) => BroadcastChannelLike | null;
  } = {}
): StudyRepositorySyncHandle {
  const tabId = options.tabId ?? makeDefaultTabId();
  const factory = options.createChannel ?? defaultChannelFactory;
  const channel = factory(options.channelName ?? STUDY_REPOSITORY_CHANNEL_NAME);
  const listeners = new Set<(event: StudyRepositorySyncEvent) => void>();

  const onMessage = (messageEvent: MessageEvent<unknown>) => {
    const payload = messageEvent.data;
    if (!isSyncEvent(payload) || payload.tabId === tabId) return;
    for (const listener of listeners) {
      listener(payload);
    }
  };

  channel?.addEventListener("message", onMessage);

  return {
    tabId,

    publish(event): void {
      if (!channel) return;
      const fullEvent = { ...event, tabId } as StudyRepositorySyncEvent;
      try {
        channel.postMessage(fullEvent);
      } catch {
        // Ignore channel post failures on closing tabs.
      }
    },

    subscribe(listener: (event: StudyRepositorySyncEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    close(): void {
      listeners.clear();
      if (!channel) return;
      try {
        channel.removeEventListener("message", onMessage);
        channel.close();
      } catch {
        // Ignore close errors.
      }
    },
  };
}
