[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / createRunState

# Function: createRunState()

> **createRunState**(`plan`, `seed?`): [`RunState`](../interfaces/RunState.md)

A fresh run for `seed`: the first act's Boss drawn from its pool, and the
first Blind dealt with full CPU. The first Blind draws no crisis. A later
act draws its Boss as its study starts, so a campaign's first act plays
exactly as the act does on its own.

## Parameters

### plan

[`RunPlan`](../type-aliases/RunPlan.md)

### seed?

`string` = `DEFAULT_SEED`

## Returns

[`RunState`](../interfaces/RunState.md)
