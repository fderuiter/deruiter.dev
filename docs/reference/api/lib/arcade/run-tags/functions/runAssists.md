[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / runAssists

# Function: runAssists()

> **runAssists**(`tags`, `policy`): `Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

The tuning a session plays with now: every assist in the policy, at the
run's setting or its first level. Read this, not the current input, so
the ratchet holds.

## Parameters

### tags

[`RunTags`](../interfaces/RunTags.md)

The run so far.

### policy

[`FairnessPolicy`](../interfaces/FairnessPolicy.md)

The game's assist table.

## Returns

`Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

Each assist's setting.
