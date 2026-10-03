[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/team](../README.md) / adjustTrust

# Function: adjustTrust()

> **adjustTrust**(`world`, `memberId`, `cause`): `object`

Moves a member's trust for a reason. Talking only counts the first time
each day, so trust cannot be farmed by pestering.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### memberId

`string`

### cause

[`TrustCause`](../../../types/type-aliases/TrustCause.md)

## Returns

`object`

### delta

> **delta**: `number`

### world

> **world**: [`WorldState`](../../../types/interfaces/WorldState.md)
