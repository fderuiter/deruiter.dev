/**
 * The append-only audit trail. Entries are frozen when written and the log
 * only ever grows; supersession is recorded, never rewritten.
 */
import type { AuditTrailEvent } from "../types";
import { minuteToIso, trialDayOf } from "./clock";

/** Fields a caller supplies for a new audit entry. */
export type AuditDraft = Omit<
  AuditTrailEvent,
  "eventId" | "timestamp" | "trialDay"
>;

/** An append-only, frozen audit log. */
export class AuditTrail {
  private readonly events: AuditTrailEvent[] = [];

  /** Appends a frozen entry stamped with the clock minute. */
  append(minute: number, draft: AuditDraft): AuditTrailEvent {
    const event: AuditTrailEvent = Object.freeze({
      eventId: `evt-${String(this.events.length + 1).padStart(5, "0")}`,
      timestamp: minuteToIso(minute),
      trialDay: trialDayOf(minute),
      ...draft,
    });
    this.events.push(event);
    return event;
  }

  /** A read-only view of every entry in order. */
  list(): readonly AuditTrailEvent[] {
    return this.events;
  }

  /** Number of entries. */
  get length(): number {
    return this.events.length;
  }
}
