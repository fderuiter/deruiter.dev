[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-data](../README.md) / recordEchoMilestones

# Function: recordEchoMilestones()

> **recordEchoMilestones**(`streak`): `void`

Records the Echo trophy milestones a streak of `streak` has reached.
Unlocking is idempotent, so calling it again for the same streak, or with
the stored best on load, unlocks nothing twice.

## Parameters

### streak

`number`

## Returns

`void`
