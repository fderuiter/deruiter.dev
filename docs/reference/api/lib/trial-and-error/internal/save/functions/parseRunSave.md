[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/save](../README.md) / parseRunSave

# Function: parseRunSave()

> **parseRunSave**(`json`, `acts`): [`RestoredRun`](../interfaces/RestoredRun.md) \| `null`

Rebuilds a saved run, or returns null when there is nothing to resume:
corrupt JSON, an unknown version, a schema mismatch, a plan (an act or the
campaign) that no longer exists, a replay that fails, or a run that has already ended. Never
throws. Any selection is cleared as recorded moves, so the resumed run and
its log stay in step.

## Parameters

### json

`string` \| `null`

### acts

readonly [`RunPlan`](../../run/type-aliases/RunPlan.md)[]

## Returns

[`RestoredRun`](../interfaces/RestoredRun.md) \| `null`
