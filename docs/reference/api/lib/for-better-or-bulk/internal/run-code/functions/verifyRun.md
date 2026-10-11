[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/run-code](../README.md) / verifyRun

# Function: verifyRun()

> **verifyRun**(`run`): [`RunVerification`](../type-aliases/RunVerification.md)

Replays a run strictly and checks the replay reproduces its own result. A
strict replay refuses the first decision that does not fit the state.

## Parameters

### run

[`SharedRun`](../interfaces/SharedRun.md)

## Returns

[`RunVerification`](../type-aliases/RunVerification.md)
