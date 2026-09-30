[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / createRunState

# Function: createRunState()

> **createRunState**(`authored`, `seed?`, `options?`): [`RunState`](../interfaces/RunState.md)

A fresh run for `seed`: the first act's Boss drawn from its pool, and the
first Blind dealt with full CPU. The first Blind draws no crisis. A later
act draws its Boss as its study starts, so a campaign's first act plays
exactly as the act does on its own.

`options` chooses the sponsor and stake (#950); the defaults, Virtual
Biotech at stake 1, leave the run exactly as it plays without them. The
sponsor's starting kit is in the first table, and the choice is kept on
the run, which records only what differs from the defaults.

## Parameters

### authored

[`RunPlan`](../type-aliases/RunPlan.md)

### seed?

`string` = `DEFAULT_SEED`

### options?

`Partial`\<[`RunChoice`](../../run-rules/interfaces/RunChoice.md)\> = `{}`

## Returns

[`RunState`](../interfaces/RunState.md)
