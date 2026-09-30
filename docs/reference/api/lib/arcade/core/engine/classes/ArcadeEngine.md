[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/engine](../README.md) / ArcadeEngine

# Abstract Class: ArcadeEngine\<TState, TSnapshot\>

Base abstract class and typed EventBus for all headless arcade game engines.
Zero framework dependencies. Testable in pure Node.js/Vitest.

## Extended by

- [`ClinicalTrialChaosEngine`](../../../../clinical-trial-chaos/arcade-engine/classes/ClinicalTrialChaosEngine.md)
- [`GarminWatchEngine`](../../../../garmin-engine/classes/GarminWatchEngine.md)
- [`LaserLoonEngine`](../../../../laser-loon/engine/classes/LaserLoonEngine.md)
- [`OetDescentEngine`](../../../../patrol/oet-engine/classes/OetDescentEngine.md)
- [`RetroLabyrinthEngine`](../../../../retro-labyrinth/engine/classes/RetroLabyrinthEngine.md)
- [`WorkingWithDuckEngine`](../../../../working-with-duck-engine/classes/WorkingWithDuckEngine.md)

## Type Parameters

### TState

`TState`

### TSnapshot

`TSnapshot`

## Constructors

### Constructor

> **new ArcadeEngine**\<`TState`, `TSnapshot`\>(`initialState`): `ArcadeEngine`\<`TState`, `TSnapshot`\>

#### Parameters

##### initialState

`TState`

#### Returns

`ArcadeEngine`\<`TState`, `TSnapshot`\>

## Properties

### cachedSnapshot

> `protected` **cachedSnapshot**: `TSnapshot` \| `null` = `null`

***

### state

> `protected` **state**: `TState`

## Methods

### createSnapshot()

> `abstract` **createSnapshot**(): `TSnapshot`

Generates a fresh immutable state snapshot.

#### Returns

`TSnapshot`

***

### destroy()

> **destroy**(): `void`

Cleans up engine timers, event subscriptions, and resources.

#### Returns

`void`

***

### emit()

> **emit**\<`T`\>(`event`, `payload`): `void`

Emits a typed event to registered listeners.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### event

`string`

##### payload

`T`

#### Returns

`void`

***

### getSnapshot()

> **getSnapshot**(): `TSnapshot`

Returns a cached immutable state snapshot for React useSyncExternalStore.
Reference is preserved until notifySubscribers() is explicitly called.

#### Returns

`TSnapshot`

***

### init()

> `abstract` **init**(): `void`

Initializes engine resources, object pools, and audio bindings.

#### Returns

`void`

***

### invalidateSnapshot()

> **invalidateSnapshot**(): `void`

Invalidates cached snapshot so the next getSnapshot() recomputes fresh state.

#### Returns

`void`

***

### notifySubscribers()

> **notifySubscribers**(): `void`

Invalidates cached snapshot and broadcasts a state change to subscribers.

#### Returns

`void`

***

### on()

> **on**\<`T`\>(`event`, `callback`): () => `void`

Subscribes to a typed one-shot action event (e.g. sfx, haptic, screen shake).

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### event

`string`

##### callback

(`payload`) => `void`

#### Returns

() => `void`

***

### render()

> `abstract` **render**(`ctx`, `alpha`): `void`

Renders in-world graphics to the 2D canvas with sub-frame alpha interpolation.

#### Parameters

##### ctx

`CanvasRenderingContext2D`

##### alpha

`number`

#### Returns

`void`

***

### resize()

> **resize**(`_width`, `_height`, `_dpr`): `void`

Handles canvas dimension and device pixel ratio resize events.

#### Parameters

##### \_width

`number`

##### \_height

`number`

##### \_dpr

`number`

#### Returns

`void`

***

### subscribe()

> **subscribe**(`callback`): () => `void`

Subscribes a listener to snapshot state updates (React useSyncExternalStore).

#### Parameters

##### callback

() => `void`

#### Returns

() => `void`

***

### update()

> `abstract` **update**(`dt`): `void`

Advances deterministic simulation physics by fixed delta time dt (in seconds).

#### Parameters

##### dt

`number`

#### Returns

`void`
