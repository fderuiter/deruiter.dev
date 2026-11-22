# Offline queue store

Reference for the IndexedDB store that will replace the localStorage offline
queue ([#3807](https://github.com/fderuiter/deruiter.dev/issues/3807)). It
records the store contract, the slice plan, and what each queue consumer's
endpoint already does about duplicate requests.

## Why IndexedDB

The current queue in `hooks/useOfflineQueue.ts` keeps its entries in one
localStorage array, and every change reads, modifies and writes that whole
array. Two tabs can interleave those steps and lose each other's rows.
localStorage offers no atomic compare-and-swap, so a lease kept there can't
fix this, and a Web Lock around flushing doesn't cover enqueue, replacement
or acknowledgement. In IndexedDB each of those operations is one short
transaction, and the data survives a restart.

## Status

| Slice | Scope | State |
| --- | --- | --- |
| 1 | `lib/offline-queue`: store schema, atomic entry operations and the legacy import | Implemented, tested in `__tests__/offline-queue-store.test.ts` |
| 2 | Claims with owner tokens and leases, persisted deadlines in the dispatcher, timeout and expiry recovery, and moving `hooks/useOfflineQueue.ts` and `components/CaseStudyFeedbackSection.tsx` onto the store | Pending |
| 3 | Endpoint work where the audit below finds a gap | Pending |

Until slice 2 lands, the site still uses the localStorage queue. Nothing reads
or writes the IndexedDB store yet.

## Schema (version 1)

The database is `portfolio_offline_queue`.

| Object store | Key | Holds |
| --- | --- | --- |
| `queue` | `id` | `OfflineQueueEntry`: the request, `revision`, `retries`, `maxRetries`, `nextAttemptAt` (wall-clock milliseconds) and `order` (first in, first out) |
| `deadLetters` | `id` | `OfflineDeadLetter`: an entry plus `failedAt`, `statusCode` and `failureReason`. The newest 50 are kept. |
| `meta` | string | `nextOrder` counter and the `legacyImport` marker |

## Operations

Each operation is one transaction. A response settles only the revision that
was sent, so a replacement made while a request is in flight survives (#3795).

| Operation | Rule |
| --- | --- |
| `enqueue(input, now)` | A new id goes to the end of the line. A queued id is replaced in place: its revision goes up by one, its retries go back to 0 and it is due at once. |
| `acknowledge(sent)` | Deletes the entry only if it is still the sent revision. |
| `recordRetry(sent, retries, nextAttemptAt)` | Stores the retry count and the deadline together, on the sent revision only. |
| `moveToDeadLetters(sent, failure)` | Moves the sent revision into `deadLetters`, replacing any dead letter with the same id and capping at 50, in one transaction. |
| `retryDeadLetter(id, now)` | Re-queues a dead letter, unless a newer request with the same id is already queued. In that case the dead letter is only dismissed. |
| `importLegacy(queue, deadLetters, now)` | See below. |

A transaction that aborts writes nothing. It rejects with
`OfflineQueueStoreError` and the code `TRANSACTION_ABORTED` or
`QUOTA_EXCEEDED`. If IndexedDB is missing or blocked, opening the store
returns `STORE_UNAVAILABLE`. Callers must then report the queue as volatile
and must not treat a write as stored.

## Legacy import

The import reads the bare localStorage arrays (`portfolio_offline_queue` and
`portfolio_offline_dlq`), validates each row and writes the valid ones in the
same transaction as the `legacyImport` marker.

- A missing `revision` is read as 0.
- A row with no `nextAttemptAt` becomes due at import time. The result counts
  these rows in `deadlinesInitialized`, so nobody reads them as an old deadline.
- Rows with no id, no endpoint or no body are skipped and counted. So are
  dead letters with no status or reason.
- A row whose id the store already holds is skipped, because the stored entry
  is newer.
- If the import aborts, nothing is imported and the marker isn't written, so
  the next start tries again. Once the import has committed, it does nothing.

Slice 2 decides when the legacy keys are retired and stops the old dispatcher
from reading them once the import has committed.

## Endpoint audit

Coordinating tabs gives at-least-once attempts, not exactly-once effects. A
lease that expires after the server accepted a request can send it again, so
each endpoint must tolerate a replay.

| Consumer | Endpoint | Replay behavior today | Gap |
| --- | --- | --- | --- |
| Reactions (`CaseStudyFeedbackSection`) | `POST /api/case-studies/reactions` | The direct path uses `createMany` with `skipDuplicates`, backed by `@@unique([caseStudySlug, connectionHash, reactionType])`. The buffered path pins each event's primary key. A replay adds no second reaction. | None known. |
| Feedback (`CaseStudyFeedbackSection`) | `POST /api/case-studies/feedback` | `submitFeedback` looks for feedback from the same connection hash in the last hour, then creates a row. The check and the insert are separate statements. | Pending. Two concurrent replays can both pass the check, and a replay more than an hour later creates a second row. Fixing this needs an operation key per payload revision, bound atomically to the stored row (slice 3). |

Telemetry uses its own outbox (`telemetryOutbox`) and is outside this
migration.
