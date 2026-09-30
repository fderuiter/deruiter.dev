import { generateId } from "@/lib/utils";

/**
 * Pure LiveAnnouncer Engine & State Machine
 *
 * Provides a framework-agnostic, zero-React queue management engine for screen reader live region announcements:
 * - Bounded polite queuing: the newest waiting status update supersedes older ones
 * - Assertive preemption for critical alerts
 * - Deterministic auto-expiration timers
 * - PII masking for Social Security Numbers and sensitive identifiers
 * - Snapshot subscriptions compatible with useSyncExternalStore
 */

export type Priority = "polite" | "assertive";

export interface AnnounceItem {
  id: string;
  text: string;
  priority: Priority;
  createdAt?: number;
}

export interface AnnouncerState {
  activePolite: AnnounceItem | null;
  activeAssertive: AnnounceItem | null;
  politeQueue: AnnounceItem[];
  assertiveQueue: AnnounceItem[];
}

export type LiveAnnouncerListener = () => void;

export interface LiveAnnouncerOptions {
  /**
   * Auto-expiration timeout duration in milliseconds for active announcements.
   * Defaults to 3000ms.
   */
  expirationMs?: number;
  /**
   * Whether to sanitize sensitive personal identifiers such as SSNs.
   * Defaults to true.
   */
  sanitizePII?: boolean;
  /**
   * Minimum time in milliseconds a polite announcement stays in the live region
   * before a newer polite announcement replaces it. Without a newer one waiting,
   * the announcement stays for the full expiration.
   * Defaults to 1000ms and is clamped to the expiration timeout.
   */
  minPoliteDwellMs?: number;
}

export const initialAnnouncerState: AnnouncerState = {
  activePolite: null,
  activeAssertive: null,
  politeQueue: [],
  assertiveQueue: [],
};

let nextAnnounceId = 0;
function generateAnnounceId(): string {
  return generateId(`announcement-${++nextAnnounceId}`);
}

/**
 * Sanitizes Social Security Numbers and sensitive personal identifiers prior to live region updates.
 *
 * @param message Raw announcement string.
 * @returns Sanitized string with PII replaced by masked asterisks.
 */
export function sanitizePII(message: string): string {
  if (typeof message !== "string") return "";
  return message.replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, "***-**-****");
}

/**
 * Pure LiveAnnouncer Engine managing bounded polite queuing, assertive preemption, and auto-expiration timers.
 *
 * At most one polite announcement waits at a time: a new polite message replaces any
 * queued one that has not been played, so a burst of status updates announces the latest
 * state within about a second instead of replaying a stale backlog. The playing polite
 * message is kept for a minimum dwell so screen readers have time to start speaking it.
 */
export class LiveAnnouncer {
  private state: AnnouncerState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private politeDwellElapsed = false;
  private listeners: Set<LiveAnnouncerListener> = new Set();
  private expirationMs: number;
  private shouldSanitizePII: boolean;
  private minPoliteDwellMs: number;

  constructor(options: LiveAnnouncerOptions = {}) {
    this.expirationMs = options.expirationMs ?? 3000;
    this.shouldSanitizePII = options.sanitizePII ?? true;
    const requestedDwellMs = Math.max(0, options.minPoliteDwellMs ?? 1000);
    this.minPoliteDwellMs = Math.min(requestedDwellMs, this.expirationMs);
    this.state = {
      activePolite: null,
      activeAssertive: null,
      politeQueue: [],
      assertiveQueue: [],
    };
  }

  /**
   * Subscribes a listener callback to state changes.
   *
   * @param listener Callback function invoked whenever the snapshot transitions.
   * @returns Unsubscribe function to detach the listener.
   */
  subscribe(listener: LiveAnnouncerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns the current immutable snapshot of the announcer state.
   */
  getSnapshot(): AnnouncerState {
    return this.state;
  }

  /**
   * Enqueues or plays an announcement based on priority and current active state.
   *
   * @param message Text content to announce to assistive technologies.
   * @param priority Announcement priority level (polite or assertive).
   * @returns The generated announcement item or null if invalid.
   */
  announce(
    message: string,
    priority: Priority = "polite"
  ): AnnounceItem | null {
    if (typeof message !== "string") {
      return null;
    }

    const cleanText = this.shouldSanitizePII ? sanitizePII(message) : message;
    const item: AnnounceItem = {
      id: generateAnnounceId(),
      text: cleanText,
      priority,
      createdAt: Date.now(),
    };

    if (priority === "assertive") {
      if (this.state.activeAssertive === null) {
        this.clearTimer();
        this.clearDwellTimer();
        this.state = {
          ...this.state,
          activePolite: null,
          activeAssertive: item,
        };
        this.startTimer();
      } else {
        this.state = {
          ...this.state,
          assertiveQueue: [...this.state.assertiveQueue, item],
        };
      }
    } else {
      if (
        this.state.activeAssertive === null &&
        this.state.activePolite === null
      ) {
        this.state = {
          ...this.state,
          activePolite: item,
        };
        this.startPoliteTimers();
      } else if (
        this.state.activeAssertive === null &&
        this.politeDwellElapsed
      ) {
        // The playing polite message has had its minimum dwell: the newer one replaces it now.
        this.state = {
          ...this.state,
          activePolite: item,
          politeQueue: [],
        };
        this.startPoliteTimers();
      } else {
        // Only the newest waiting polite message is kept; unplayed older ones are stale.
        this.state = {
          ...this.state,
          politeQueue: [item],
        };
      }
    }

    this.notify();
    return item;
  }

  /**
   * Clears all active announcements, queued items, and cancels running timers.
   */
  clear(): void {
    this.clearTimer();
    this.clearDwellTimer();
    this.state = {
      activePolite: null,
      activeAssertive: null,
      politeQueue: [],
      assertiveQueue: [],
    };
    this.notify();
  }

  /**
   * Destroys the announcer instance, cancelling timers and removing all subscribers.
   */
  destroy(): void {
    this.clearTimer();
    this.clearDwellTimer();
    this.state = {
      activePolite: null,
      activeAssertive: null,
      politeQueue: [],
      assertiveQueue: [],
    };
    this.listeners.clear();
  }

  private startTimer(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.handleTimerComplete();
    }, this.expirationMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private startPoliteTimers(): void {
    this.startTimer();
    this.clearDwellTimer();
    this.politeDwellElapsed = false;
    this.dwellTimer = setTimeout(() => {
      this.handleDwellComplete();
    }, this.minPoliteDwellMs);
  }

  private clearDwellTimer(): void {
    if (this.dwellTimer !== null) {
      clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
    this.politeDwellElapsed = false;
  }

  private handleDwellComplete(): void {
    this.dwellTimer = null;
    this.politeDwellElapsed = true;

    if (
      this.state.activePolite !== null &&
      this.state.activeAssertive === null &&
      this.state.politeQueue.length > 0
    ) {
      const next = this.state.politeQueue[0];
      this.state = {
        ...this.state,
        activePolite: next,
        politeQueue: this.state.politeQueue.slice(1),
      };
      this.startPoliteTimers();
      this.notify();
    }
  }

  private handleTimerComplete(): void {
    this.timer = null;
    this.clearDwellTimer();

    if (this.state.activeAssertive !== null) {
      if (this.state.assertiveQueue.length > 0) {
        const next = this.state.assertiveQueue[0];
        this.state = {
          ...this.state,
          activeAssertive: next,
          assertiveQueue: this.state.assertiveQueue.slice(1),
        };
        this.startTimer();
      } else if (this.state.politeQueue.length > 0) {
        const next = this.state.politeQueue[0];
        this.state = {
          ...this.state,
          activeAssertive: null,
          activePolite: next,
          politeQueue: this.state.politeQueue.slice(1),
        };
        this.startPoliteTimers();
      } else {
        this.state = {
          ...this.state,
          activeAssertive: null,
          activePolite: null,
        };
      }
    } else if (this.state.activePolite !== null) {
      if (this.state.assertiveQueue.length > 0) {
        const next = this.state.assertiveQueue[0];
        this.state = {
          ...this.state,
          activePolite: null,
          activeAssertive: next,
          assertiveQueue: this.state.assertiveQueue.slice(1),
        };
        this.startTimer();
      } else if (this.state.politeQueue.length > 0) {
        const next = this.state.politeQueue[0];
        this.state = {
          ...this.state,
          activePolite: next,
          politeQueue: this.state.politeQueue.slice(1),
        };
        this.startPoliteTimers();
      } else {
        this.state = {
          ...this.state,
          activePolite: null,
          activeAssertive: null,
        };
      }
    } else {
      if (this.state.assertiveQueue.length > 0) {
        const next = this.state.assertiveQueue[0];
        this.state = {
          ...this.state,
          activeAssertive: next,
          assertiveQueue: this.state.assertiveQueue.slice(1),
        };
        this.startTimer();
      } else if (this.state.politeQueue.length > 0) {
        const next = this.state.politeQueue[0];
        this.state = {
          ...this.state,
          activePolite: next,
          politeQueue: this.state.politeQueue.slice(1),
        };
        this.startPoliteTimers();
      }
    }

    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/**
 * Global singleton LiveAnnouncer instance for shared application lifecycle.
 */
export const liveAnnouncer = new LiveAnnouncer();
