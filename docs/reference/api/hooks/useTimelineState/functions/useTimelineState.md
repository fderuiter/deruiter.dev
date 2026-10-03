[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useTimelineState](../README.md) / useTimelineState

# Function: useTimelineState()

> **useTimelineState**(`initialMode?`): `object`

Local state for a career timeline with a global perspective and per-card overrides.

## Parameters

### initialMode?

[`PersonaType`](../../../lib/persona/type-aliases/PersonaType.md) = `"behind-the-scenes"`

Perspective shown before the visitor chooses one. Defaults to
Behind the Scenes, the hook's original starting perspective. The rendered timeline
follows the site-wide reading mode instead, which defaults to Professional.

## Returns

`object`

### cardOverrides

> **cardOverrides**: `Record`\<`number`, [`PersonaType`](../../../lib/persona/type-aliases/PersonaType.md)\>

### getCardMode

> **getCardMode**: (`idx`) => [`PersonaType`](../../../lib/persona/type-aliases/PersonaType.md)

#### Parameters

##### idx

`number`

#### Returns

[`PersonaType`](../../../lib/persona/type-aliases/PersonaType.md)

### globalMode

> **globalMode**: [`PersonaType`](../../../lib/persona/type-aliases/PersonaType.md)

### handleCardToggle

> **handleCardToggle**: (`idx`) => `void`

#### Parameters

##### idx

`number`

#### Returns

`void`

### handleGlobalToggle

> **handleGlobalToggle**: (`mode`) => `void`

#### Parameters

##### mode

[`PersonaType`](../../../lib/persona/type-aliases/PersonaType.md)

#### Returns

`void`
