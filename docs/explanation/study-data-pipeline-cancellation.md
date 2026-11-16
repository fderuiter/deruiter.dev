# Cancel and dispose in the study-data pipeline client

`components/study-data/pipeline-client.ts` runs the /study-data pipeline in
a Web Worker. Where Workers are unavailable it loads the same session module
on the main thread. This note sets out what `cancel()` and `dispose()` mean
in each mode. It comes from R04 of the 2026-11-11 implicit-state audit
(#3792, #3805).

## What cancel means

Cancel means three things, and the two modes differ only in the first:

1. **Stop work.** A worker is terminated, so its computation stops. Work
   already running on the main thread cannot be interrupted: the session's
   `handle` runs synchronous engine code. Cancel can only stop main-thread
   work that has not started yet.
2. **Suppress the result.** Every request pending at cancel rejects with
   `PipelineCancelledError`. A late answer is dropped, so it can never reach
   the page.
3. **Reset the session.** The next request runs in a fresh worker or a fresh
   main-thread session. Either one holds no run until it is asked for one.

`dispose()` does the same, rejecting with `PipelineDisposedError`, which
extends `PipelineCancelledError`. The client stays usable afterwards, so an
owner that sets up again, as React Strict Mode does, keeps the same client.

## Transitions

| Moment of cancel or dispose | Worker mode | Main-thread mode |
| --- | --- | --- |
| No request yet | No-op | No-op |
| Request waiting for the worker or session to load | Rejected, worker terminated | Rejected, `handle` never runs |
| Request in flight | Rejected, worker terminated, work stops | Rejected, work finishes, answer dropped |
| Request already answered | Nothing to reject; worker terminated | Nothing to reject; session dropped |
| Next request | Fresh worker, no run held | Fresh session, no run held |

The main-thread rows are new in this change. Before it, `cancel()` returned
straight away when no worker existed. A main-thread request kept running,
its answer still resolved to the caller, and the old session (with its last
run) was reused. `dispose()` rejected nothing on the main thread.

## How it is enforced

Main-thread requests are tracked by generation. Each request records the
generation it started in. Cancel and dispose start a new generation, drop the
cached session and reject the older waiters at once. A request whose
generation is no longer current skips `handle` if the session has not loaded
yet, and drops its answer if it has.

`__tests__/study-data-pipeline-cancel-contract.test.ts` checks each
main-thread row. It uses a session module whose loading and answers settle
only when the test releases them. The worker rows are covered by
`__tests__/study-data-pipeline-client.test.ts`.

## What the page relies on

`StudyDataWorkbench` already ignores a run or rerun answer from an older
`runToken`, and it treats `PipelineCancelledError` as expected. Its cancel
path reruns the previous run to restore the view. That works in both modes
now that both start from an empty session. No product choice was needed:
main-thread mode now behaves as the client's interface already described for
the worker.
