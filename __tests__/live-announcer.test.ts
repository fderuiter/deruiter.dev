import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LiveAnnouncer,
  sanitizePII,
  type AnnouncerState,
} from "@/lib/a11y/announcer";

describe("LiveAnnouncer Engine (Pure State Machine & Internal Timers)", () => {
  let announcer: LiveAnnouncer;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    announcer = new LiveAnnouncer();
  });

  afterEach(() => {
    announcer.destroy();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("Initial State & Snapshot Subscriptions", () => {
    it("initializes with null active items and empty queues", () => {
      const snapshot: AnnouncerState = announcer.getSnapshot();
      expect(snapshot.activePolite).toBeNull();
      expect(snapshot.activeAssertive).toBeNull();
      expect(snapshot.politeQueue).toEqual([]);
      expect(snapshot.assertiveQueue).toEqual([]);
    });

    it("notifies subscribers when announcements are made and states transition", () => {
      const listener = vi.fn();
      const unsubscribe = announcer.subscribe(listener);

      announcer.announce("First polite update", "polite");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(announcer.getSnapshot().activePolite?.text).toBe(
        "First polite update"
      );

      vi.advanceTimersByTime(3000);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(announcer.getSnapshot().activePolite).toBeNull();

      unsubscribe();
      announcer.announce("Second update after unsubscribe", "polite");
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("returns an immutable snapshot with referential integrity across mutations", () => {
      const snap1 = announcer.getSnapshot();
      announcer.announce("Test message", "polite");
      const snap2 = announcer.getSnapshot();

      expect(snap1).not.toBe(snap2);
      expect(snap1.activePolite).toBeNull();
      expect(snap2.activePolite?.text).toBe("Test message");
    });
  });

  describe("Polite Queuing Mechanics", () => {
    it("immediately activates the first polite announcement when idle", () => {
      const item = announcer.announce("System initialized", "polite");
      expect(item).not.toBeNull();
      expect(item?.text).toBe("System initialized");
      expect(item?.priority).toBe("polite");

      const state = announcer.getSnapshot();
      expect(state.activePolite?.text).toBe("System initialized");
      expect(state.politeQueue).toHaveLength(0);
    });

    it("holds the newest waiting polite message without interrupting the active one", () => {
      announcer.announce("Message 1", "polite");
      announcer.announce("Message 2", "polite");
      announcer.announce("Message 3", "polite");

      let state = announcer.getSnapshot();
      expect(state.activePolite?.text).toBe("Message 1");
      expect(state.politeQueue).toHaveLength(1);
      expect(state.politeQueue[0].text).toBe("Message 3");

      // Message 1 keeps its minimum dwell (1000ms) before the waiting message replaces it.
      vi.advanceTimersByTime(1000);
      state = announcer.getSnapshot();
      expect(state.activePolite?.text).toBe("Message 3");
      expect(state.politeQueue).toHaveLength(0);

      // Message 3 then plays for the full 3000ms.
      vi.advanceTimersByTime(2999);
      expect(announcer.getSnapshot().activePolite?.text).toBe("Message 3");
      vi.advanceTimersByTime(1);
      state = announcer.getSnapshot();
      expect(state.activePolite).toBeNull();
      expect(state.politeQueue).toHaveLength(0);
    });

    it("plays polite messages in order when each arrives after the previous one's dwell", () => {
      announcer.announce("Message 1", "polite");
      vi.advanceTimersByTime(1500);
      announcer.announce("Message 2", "polite");
      expect(announcer.getSnapshot().activePolite?.text).toBe("Message 2");
      vi.advanceTimersByTime(1500);
      announcer.announce("Message 3", "polite");
      expect(announcer.getSnapshot().activePolite?.text).toBe("Message 3");
      expect(announcer.getSnapshot().politeQueue).toHaveLength(0);
    });

    it("does not reset the active timer when new polite messages are queued", () => {
      announcer.announce("Message 1", "polite");

      // Advance 2000ms into Message 1
      vi.advanceTimersByTime(2000);
      expect(announcer.getSnapshot().activePolite?.text).toBe("Message 1");

      // Queue Message 2 at t = 2000ms
      announcer.announce("Message 2", "polite");

      // Advance 1000ms more (t = 3000ms total for Message 1)
      vi.advanceTimersByTime(1000);
      expect(announcer.getSnapshot().activePolite?.text).toBe("Message 2");
    });
  });

  describe("Bounded Polite Queue (#1635)", () => {
    it("announces the newest of a 30-message polite burst within a few seconds and drops stale ones", () => {
      const played: string[] = [];
      announcer.subscribe(() => {
        const text = announcer.getSnapshot().activePolite?.text;
        if (text && played[played.length - 1] !== text) played.push(text);
      });

      // ~30 Card Table events over ~3 seconds (one every 100ms).
      for (let i = 1; i <= 30; i++) {
        announcer.announce(`Event ${i}`, "polite");
        expect(announcer.getSnapshot().politeQueue.length).toBeLessThanOrEqual(
          1
        );
        if (i < 30) vi.advanceTimersByTime(100);
      }

      // The latest state reaches the live region within ~1s of being announced.
      vi.advanceTimersByTime(1000);
      expect(announcer.getSnapshot().activePolite?.text).toBe("Event 30");
      expect(announcer.getSnapshot().politeQueue).toHaveLength(0);

      // Stale intermediate messages were superseded rather than replayed.
      expect(played.length).toBeLessThan(10);
      expect(played[0]).toBe("Event 1");
      expect(played[played.length - 1]).toBe("Event 30");

      // The final message holds for the full expiration, then the region clears.
      vi.advanceTimersByTime(3000);
      expect(announcer.getSnapshot().activePolite).toBeNull();
      expect(played).not.toContain("Event 29");
    });

    it("keeps the active message for a minimum dwell before a newer one replaces it", () => {
      announcer.announce("First", "polite");
      announcer.announce("Stale", "polite");
      announcer.announce("Latest", "polite");

      const state = announcer.getSnapshot();
      expect(state.activePolite?.text).toBe("First");
      expect(state.politeQueue.map((item) => item.text)).toEqual(["Latest"]);

      vi.advanceTimersByTime(999);
      expect(announcer.getSnapshot().activePolite?.text).toBe("First");

      vi.advanceTimersByTime(1);
      expect(announcer.getSnapshot().activePolite?.text).toBe("Latest");
      expect(announcer.getSnapshot().politeQueue).toHaveLength(0);
    });

    it("still plays a single polite message for its full duration", () => {
      announcer.announce("Only message", "polite");
      vi.advanceTimersByTime(2999);
      expect(announcer.getSnapshot().activePolite?.text).toBe("Only message");
      vi.advanceTimersByTime(1);
      expect(announcer.getSnapshot().activePolite).toBeNull();
    });

    it("lets assertive alerts preempt a polite burst and resumes with only the newest polite message", () => {
      for (let i = 1; i <= 10; i++) announcer.announce(`Polite ${i}`, "polite");
      announcer.announce("Blind failed", "assertive");
      for (let i = 11; i <= 20; i++)
        announcer.announce(`Polite ${i}`, "polite");

      let state = announcer.getSnapshot();
      expect(state.activeAssertive?.text).toBe("Blind failed");
      expect(state.activePolite).toBeNull();
      expect(state.politeQueue.map((item) => item.text)).toEqual(["Polite 20"]);

      // The assertive alert is not cut short by the waiting polite message.
      vi.advanceTimersByTime(2999);
      expect(announcer.getSnapshot().activeAssertive?.text).toBe(
        "Blind failed"
      );

      vi.advanceTimersByTime(1);
      state = announcer.getSnapshot();
      expect(state.activeAssertive).toBeNull();
      expect(state.activePolite?.text).toBe("Polite 20");
      expect(state.politeQueue).toHaveLength(0);
    });

    it("honours a custom minimum dwell and clamps it to the expiration", () => {
      const custom = new LiveAnnouncer({ minPoliteDwellMs: 500 });
      custom.announce("A", "polite");
      custom.announce("B", "polite");
      vi.advanceTimersByTime(500);
      expect(custom.getSnapshot().activePolite?.text).toBe("B");
      custom.destroy();

      const clamped = new LiveAnnouncer({
        expirationMs: 2000,
        minPoliteDwellMs: 10_000,
      });
      clamped.announce("A", "polite");
      clamped.announce("B", "polite");
      vi.advanceTimersByTime(2000);
      expect(clamped.getSnapshot().activePolite?.text).toBe("B");
      clamped.destroy();
    });
  });

  describe("Assertive Preemption Mechanics", () => {
    it("immediately preempts active polite announcement and activates assertive alert", () => {
      announcer.announce("Long background status update", "polite");
      expect(announcer.getSnapshot().activePolite?.text).toBe(
        "Long background status update"
      );
      expect(announcer.getSnapshot().activeAssertive).toBeNull();

      // Assertive announcement preempts
      announcer.announce("Critical network error detected!", "assertive");
      const state = announcer.getSnapshot();

      expect(state.activePolite).toBeNull();
      expect(state.activeAssertive?.text).toBe(
        "Critical network error detected!"
      );
      expect(state.activeAssertive?.priority).toBe("assertive");
    });

    it("resumes pending polite queue after assertive queue drains", () => {
      announcer.announce("Polite 1", "polite");
      announcer.announce("Polite 2", "polite");

      // Preempt with assertive message
      announcer.announce("Assertive 1", "assertive");

      let state = announcer.getSnapshot();
      expect(state.activePolite).toBeNull();
      expect(state.activeAssertive?.text).toBe("Assertive 1");
      expect(state.politeQueue).toHaveLength(1);
      expect(state.politeQueue[0].text).toBe("Polite 2");

      // Advance 3000ms to complete Assertive 1
      vi.advanceTimersByTime(3000);
      state = announcer.getSnapshot();
      expect(state.activeAssertive).toBeNull();
      expect(state.activePolite?.text).toBe("Polite 2");
      expect(state.politeQueue).toHaveLength(0);

      // Advance 3000ms to complete Polite 2
      vi.advanceTimersByTime(3000);
      state = announcer.getSnapshot();
      expect(state.activePolite).toBeNull();
      expect(state.activeAssertive).toBeNull();
    });

    it("queues subsequent assertive alerts in FIFO order in assertiveQueue", () => {
      announcer.announce("Alert 1", "assertive");
      announcer.announce("Alert 2", "assertive");
      announcer.announce("Alert 3", "assertive");

      let state = announcer.getSnapshot();
      expect(state.activeAssertive?.text).toBe("Alert 1");
      expect(state.assertiveQueue).toHaveLength(2);
      expect(state.assertiveQueue[0].text).toBe("Alert 2");
      expect(state.assertiveQueue[1].text).toBe("Alert 3");

      // Advance past Alert 1
      vi.advanceTimersByTime(3000);
      state = announcer.getSnapshot();
      expect(state.activeAssertive?.text).toBe("Alert 2");
      expect(state.assertiveQueue).toHaveLength(1);

      // Advance past Alert 2
      vi.advanceTimersByTime(3000);
      state = announcer.getSnapshot();
      expect(state.activeAssertive?.text).toBe("Alert 3");
      expect(state.assertiveQueue).toHaveLength(0);

      // Advance past Alert 3
      vi.advanceTimersByTime(3000);
      state = announcer.getSnapshot();
      expect(state.activeAssertive).toBeNull();
    });
  });

  describe("3-Second Auto-Expiration Dismissal", () => {
    it("automatically dismisses polite message after exactly 3000ms", () => {
      announcer.announce("Auto dismissing polite", "polite");
      expect(announcer.getSnapshot().activePolite?.text).toBe(
        "Auto dismissing polite"
      );

      vi.advanceTimersByTime(2999);
      expect(announcer.getSnapshot().activePolite?.text).toBe(
        "Auto dismissing polite"
      );

      vi.advanceTimersByTime(1);
      expect(announcer.getSnapshot().activePolite).toBeNull();
    });

    it("automatically dismisses assertive message after exactly 3000ms", () => {
      announcer.announce("Auto dismissing assertive", "assertive");
      expect(announcer.getSnapshot().activeAssertive?.text).toBe(
        "Auto dismissing assertive"
      );

      vi.advanceTimersByTime(2999);
      expect(announcer.getSnapshot().activeAssertive?.text).toBe(
        "Auto dismissing assertive"
      );

      vi.advanceTimersByTime(1);
      expect(announcer.getSnapshot().activeAssertive).toBeNull();
    });

    it("supports customizable expiration timeout via constructor options", () => {
      const customAnnouncer = new LiveAnnouncer({ expirationMs: 5000 });
      customAnnouncer.announce("Custom 5s duration", "polite");

      vi.advanceTimersByTime(4999);
      expect(customAnnouncer.getSnapshot().activePolite?.text).toBe(
        "Custom 5s duration"
      );

      vi.advanceTimersByTime(1);
      expect(customAnnouncer.getSnapshot().activePolite).toBeNull();

      customAnnouncer.destroy();
    });
  });

  describe("PII Masking & SSN Redaction", () => {
    it("redacts standard SSN patterns using sanitizePII helper function", () => {
      expect(sanitizePII("Social Security: 123-45-6789")).toBe(
        "Social Security: ***-**-****"
      );
      expect(sanitizePII("Space delimited: 987 65 4321")).toBe(
        "Space delimited: ***-**-****"
      );
      expect(sanitizePII("Dot delimited: 111.22.3333")).toBe(
        "Dot delimited: ***-**-****"
      );
      expect(sanitizePII("Raw digits: 123456789")).toBe(
        "Raw digits: ***-**-****"
      );
    });

    it("redacts multiple SSNs within a single message", () => {
      const input = "Primary SSN: 123-45-6789, Secondary SSN: 987-65-4321.";
      expect(sanitizePII(input)).toBe(
        "Primary SSN: ***-**-****, Secondary SSN: ***-**-****."
      );
    });

    it("preserves non-PII numerical sequences like dates, years, or status codes", () => {
      expect(sanitizePII("HTTP 404 Error in year 2026")).toBe(
        "HTTP 404 Error in year 2026"
      );
      expect(sanitizePII("Item #1234567 with 89 units")).toBe(
        "Item #1234567 with 89 units"
      );
    });

    it("masks SSN automatically when announced through LiveAnnouncer", () => {
      announcer.announce("Patient file 123-45-6789 updated", "polite");
      expect(announcer.getSnapshot().activePolite?.text).toBe(
        "Patient file ***-**-**** updated"
      );
    });

    it("can disable PII sanitization if explicitly configured in options", () => {
      const unsanitizedAnnouncer = new LiveAnnouncer({ sanitizePII: false });
      unsanitizedAnnouncer.announce(
        "Patient file 123-45-6789 updated",
        "polite"
      );
      expect(unsanitizedAnnouncer.getSnapshot().activePolite?.text).toBe(
        "Patient file 123-45-6789 updated"
      );
      unsanitizedAnnouncer.destroy();
    });

    it("safely handles invalid or non-string inputs to sanitizePII", () => {
      // @ts-expect-error test invalid input runtime safety
      expect(sanitizePII(null)).toBe("");
      // @ts-expect-error test invalid input runtime safety
      expect(sanitizePII(undefined)).toBe("");
      // @ts-expect-error test invalid input runtime safety
      expect(sanitizePII(12345)).toBe("");
    });
  });

  describe("Lifecycle & Cleanup Management", () => {
    it("clears all active states, queued items, and timers when clear() is invoked", () => {
      announcer.announce("Polite 1", "polite");
      announcer.announce("Polite 2", "polite");
      announcer.announce("Assertive 1", "assertive");

      const listener = vi.fn();
      announcer.subscribe(listener);

      announcer.clear();
      const state = announcer.getSnapshot();

      expect(state.activePolite).toBeNull();
      expect(state.activeAssertive).toBeNull();
      expect(state.politeQueue).toEqual([]);
      expect(state.assertiveQueue).toEqual([]);
      expect(listener).toHaveBeenCalled();

      // Advancing timer does nothing after clear
      vi.advanceTimersByTime(5000);
      expect(announcer.getSnapshot().activePolite).toBeNull();
    });

    it("destroys the announcer instance and removes all active subscribers", () => {
      const listener = vi.fn();
      announcer.subscribe(listener);

      announcer.announce("Active message", "polite");
      expect(listener).toHaveBeenCalledTimes(1);

      announcer.destroy();
      expect(announcer.getSnapshot().activePolite).toBeNull();

      // After destroy, listeners should not receive updates
      announcer.announce("Post destroy message", "polite");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("handles non-string or empty announcements gracefully", () => {
      // @ts-expect-error test invalid announcement input
      const result = announcer.announce(null);
      expect(result).toBeNull();
      expect(announcer.getSnapshot().activePolite).toBeNull();
    });
  });
});
