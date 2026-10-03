/**
 * A deterministic event queue. Events at the same minute run in the spec's
 * tie-break order: site activations, scheduled visits, source submissions,
 * pipeline processing, query responses, then reconciliation. Ties within a
 * class run by insertion sequence, which is itself deterministic.
 */

/** Tie-break classes, lowest runs first. */
export const EVENT_PRIORITY = {
  SITE_ACTIVATION: 0,
  SCHEDULED_VISIT: 1,
  SOURCE_SUBMISSION: 2,
  PIPELINE_PROCESSING: 3,
  QUERY_RESPONSE: 4,
  RECONCILIATION: 5,
} as const;

/** The kinds of scheduled simulation events. */
export type SimEventKind =
  | "AMENDMENT_NOTICE"
  | "SITE_ACTIVATION"
  | "SCHEDULED_VISIT"
  | "SOURCE_SUBMISSION"
  | "PIPELINE_PROCESSING"
  | "QUERY_SEND"
  | "QUERY_RESPONSE"
  | "WAVE_END";

/** A scheduled event. */
export interface SimEvent {
  eventId: string;
  minute: number;
  priority: number;
  seq: number;
  kind: SimEventKind;
  ref: string;
}

/** Orders two events by minute, priority, then sequence. */
export function compareEvents(a: SimEvent, b: SimEvent): number {
  if (a.minute !== b.minute) return a.minute - b.minute;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.seq - b.seq;
}

/** A sorted queue of pending events. */
export class EventQueue {
  private items: SimEvent[] = [];
  private nextSeq = 0;

  /** Schedules an event and returns it. */
  push(
    minute: number,
    priority: number,
    kind: SimEventKind,
    ref: string
  ): SimEvent {
    const seq = this.nextSeq;
    this.nextSeq += 1;
    const event: SimEvent = {
      eventId: `${kind}:${ref}:${seq}`,
      minute,
      priority,
      seq,
      kind,
      ref,
    };
    let i = this.items.length;
    while (i > 0 && compareEvents(this.items[i - 1], event) > 0) i -= 1;
    this.items.splice(i, 0, event);
    return event;
  }

  /** The next event, without removing it. */
  peek(): SimEvent | undefined {
    return this.items[0];
  }

  /** Removes and returns the next event. */
  pop(): SimEvent | undefined {
    return this.items.shift();
  }

  /** Number of pending events. */
  get size(): number {
    return this.items.length;
  }

  /** A copy of the pending events in run order. */
  toArray(): SimEvent[] {
    return this.items.map((e) => ({ ...e }));
  }
}
