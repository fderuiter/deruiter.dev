# Offline queue store

Reference for the IndexedDB store that replaced the localStorage offline
queue ([#3807](https://github.com/fderuiter/deruiter.dev/issues/3807)). It
records the store contract, the slice plan, and what each queue consumer's
endpoint already does about duplicate requests.

## Why IndexedDB

The queue in `hooks/useOfflineQueue.ts` used to keep its entries in one
localStorage array, and every change read, modified and wrote that whole
array. Two tabs can interleave those steps and lose each other's rows.
localStorage offers no atomic compare-and-swap, so a lease kept there can't
fix this, and a Web Lock around flushing doesn't cover enqueue, replacement
or acknowledgement. In IndexedDB each of those operations is one short
transaction, and the data survives a restart.

## Status

| Slice | Scope | State |
| --- | --- | --- |
| 1 | `lib/offline-queue`: store schema, atomic entry operations and the legacy import | Implemented, tested in `__tests__/offline-queue-store.test.ts` |
| 2a | Claims with owner tokens and leases, and a dispatcher with persisted deadlines, request timeouts and lease-expiry recovery | Implemented, tested in `__tests__/offline-queue-dispatcher.test.ts` |
| 2b | Moving `hooks/useOfflineQueue.ts` and `components/CaseStudyFeedbackSection.tsx` onto the store and dispatcher, a memory fallback, and retiring the legacy keys | Implemented, tested in `__tests__/offline-queue-hook-storage.test.ts`, `__tests__/offline-queue-memory-store.test.ts` and the hook suites |
| 3 | Endpoint work where the audit below finds a gap | Pending |

The site queues through the IndexedDB store. The old localStorage keys are
read once, by the legacy import below, and then removed.

## Schema (version 1)

The database is `portfolio_offline_queue`.

| Object store | Key | Holds |
| --- | --- | --- |
| `queue` | `id` | `OfflineQueueEntry`: the request, `revision`, `retries`, `maxRetries`, `nextAttemptAt` (wall-clock milliseconds), `order` (first in, first out) and, while a context is sending it, `claim` (`ownerToken` and `leaseUntil`) |
| `deadLetters` | `id` | `OfflineDeadLetter`: an entry plus `failedAt`, `statusCode` and `failureReason`. The newest 50 are kept. |
| `meta` | string | `nextOrder` counter and the `legacyImport` marker |

## Operations

Each operation is one transaction. A response settles only the revision that
was sent, so a replacement made while a request is in flight survives (#3795).

| Operation | Rule |
| --- | --- |
| `enqueue(input, now)` | A new id goes to the end of the line. A queued id is replaced in place: its revision goes up by one, its retries go back to 0, it is due at once and any claim on the old revision is dropped. |
| `claimNext(ownerToken, now, options)` | Claims the first entry in send order that is due and unclaimed, or whose lease has passed, and returns when the next one becomes claimable. |
| `acknowledge(sent)` | Deletes the entry only if it is still the sent revision and, when `sent` names an owner, that owner still holds the claim. |
| `recordRetry(sent, retries, nextAttemptAt)` | Stores the retry count and the deadline together and releases the claim, under the same revision and owner check. |
| `moveToDeadLetters(sent, failure)` | Moves the sent revision into `deadLetters`, under the same check, replacing any dead letter with the same id and capping at 50, in one transaction. |
| `retryDeadLetter(id, now)` | Re-queues a dead letter, unless a newer request with the same id is already queued. In that case the dead letter is only dismissed. |
| `importLegacy(queue, deadLetters, now)` | See below. |

A transaction that aborts writes nothing. It rejects with
`OfflineQueueStoreError` and the code `TRANSACTION_ABORTED` or
`QUOTA_EXCEEDED`. If IndexedDB is missing or blocked, opening the store
returns `STORE_UNAVAILABLE`. Callers must then report the queue as volatile
and must not treat a write as stored.

## Dispatcher

`createOfflineDispatcher` sends due entries for one browsing context. It takes
the store, a `send` function that returns `ok`, `permanent` or `transient`, and
optional clock, timers and online check, which tests replace.

| Step | Rule |
| --- | --- |
| Claim | One transaction claims the next due entry with this context's random owner token. The lease lasts the 15 second request timeout plus a 5 second margin, so a live owner always settles before anyone else may take over. |
| Send | Runs with no transaction open. A request still running at the timeout is aborted and counts as a transient failure, as does a throw. |
| Settle | A second transaction checks the id, the revision and the owner token. A late response from an owner whose lease was taken over, or for a revision that was replaced, changes nothing. |
| Retry | A transient failure stores `retries + 1` and the next deadline together (2, 4, 8 and 16 seconds, then 30), then stops the pass and wakes when that entry is due. Reaching `maxRetries`, or a permanent failure, moves the entry to the dead letters. |
| Wake | Each pass schedules one timer for the earliest deadline or lease. Every flush, whether it comes from an enqueue, an online event or a reload, honors the stored deadlines, so none of them can skip a retry delay. |
| Clocks | Deadlines and leases are wall-clock times. A deadline more than 30 seconds ahead, or a lease more than one lease length ahead, can only come from a clock that moved back, so it counts as passed. A wake timer never waits longer than one lease. Delivery still depends on the clock: a clock that jumps forward makes entries due early. |
| Concurrency | Calls to `flush` in one context share one pass. Another context runs its own dispatcher, and the claim keeps the two from sending the same revision at once. |

A lease can run out after the server has accepted a request, for example when
a tab freezes, and another context then sends it again. See the endpoint audit
below.

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

The hook removes both legacy keys once the import has committed, or once the
marker shows an earlier start already imported them. A tab still running the
old build then finds them empty and stops sending those rows. If the import
fails, the keys stay for the next start.

## Hook

`hooks/useOfflineQueue.ts` opens the store once per page, imports the legacy
keys and starts one dispatcher. Its exports that change the queue are async
and resolve once the store has committed.

| Concern | Rule |
| --- | --- |
| Persistence | `getOfflineQueuePersistence()` and the hook's `persistence` are `pending` until the store opens, then `durable`. If IndexedDB is missing or blocked, the hook uses the memory store (`createMemoryOfflineQueueStore`, same contract) and reports `volatile`. Callers must not tell the visitor a volatile write survives a reload. |
| Sending | `POST`, `PUT`, `PATCH` and `DELETE` map to the API client. A 2xx is `ok`. A 4xx other than 408 or 429 is `permanent`, with the reason read from the response. Everything else, and a network error, is `transient`. |
| Dead letters | Each one is logged and announced as a `portfolio-offline-queue-error` event with the dead letter as its detail. |
| Other tabs | Each change is announced on the `portfolio-offline-queue` BroadcastChannel. Other tabs re-read the store, then flush. |
| Feedback form | `CaseStudyFeedbackSection` shows success only after the write committed. A volatile write says the feedback will be sent when the visitor is back online and asks them to keep the page open. A write the store rejects shows an error. |

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
