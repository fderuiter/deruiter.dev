[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / tickSponsor

# Function: tickSponsor()

> **tickSponsor**(`state`, `deltaSeconds`, `rand?`, `decayPerSecond?`): `object`

Advances the sponsor by `deltaSeconds`: mood decays, emails arrive, unanswered
emails escalate into follow-ups and are eventually dropped with a penalty.

## Parameters

### state

[`SponsorState`](../interfaces/SponsorState.md)

### deltaSeconds

`number`

### rand?

() => `number`

### decayPerSecond?

`number` = `SPONSOR_MOOD_DECAY_PER_SECOND`

## Returns

`object`

### events

> **events**: [`SponsorEvent`](../type-aliases/SponsorEvent.md)[]

### state

> **state**: [`SponsorState`](../interfaces/SponsorState.md)
