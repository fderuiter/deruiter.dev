[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/working-with-duck-engine](../README.md) / WorkingWithDuckEngine

# Class: WorkingWithDuckEngine

Base abstract class and typed EventBus for all headless arcade game engines.
Zero framework dependencies. Testable in pure Node.js/Vitest.

## Extends

- [`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md)\<[`WorkingWithDuckState`](../interfaces/WorkingWithDuckState.md), [`WorkingWithDuckSnapshot`](../interfaces/WorkingWithDuckSnapshot.md)\>

## Constructors

### Constructor

> **new WorkingWithDuckEngine**(`level?`, `mode?`): `WorkingWithDuckEngine`

#### Parameters

##### level?

`number` = `1`

##### mode?

`"campaign"` \| `"endless"` = `"campaign"`

#### Returns

`WorkingWithDuckEngine`

#### Overrides

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`constructor`](../../arcade/core/engine/classes/ArcadeEngine.md#constructor)

## Properties

### cachedSnapshot

> `protected` **cachedSnapshot**: [`WorkingWithDuckSnapshot`](../interfaces/WorkingWithDuckSnapshot.md) \| `null` = `null`

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`cachedSnapshot`](../../arcade/core/engine/classes/ArcadeEngine.md#cachedsnapshot)

***

### state

> `protected` **state**: [`WorkingWithDuckState`](../interfaces/WorkingWithDuckState.md)

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`state`](../../arcade/core/engine/classes/ArcadeEngine.md#state)

## Methods

### createSnapshot()

> **createSnapshot**(): [`WorkingWithDuckSnapshot`](../interfaces/WorkingWithDuckSnapshot.md)

Generates a fresh immutable state snapshot.

#### Returns

[`WorkingWithDuckSnapshot`](../interfaces/WorkingWithDuckSnapshot.md)

#### Overrides

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`createSnapshot`](../../arcade/core/engine/classes/ArcadeEngine.md#createsnapshot)

***

### destroy()

> **destroy**(): `void`

Cleans up engine timers, event subscriptions, and resources.

#### Returns

`void`

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`destroy`](../../arcade/core/engine/classes/ArcadeEngine.md#destroy)

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

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`emit`](../../arcade/core/engine/classes/ArcadeEngine.md#emit)

***

### getSnapshot()

> **getSnapshot**(): [`WorkingWithDuckSnapshot`](../interfaces/WorkingWithDuckSnapshot.md)

Returns a cached immutable state snapshot for React useSyncExternalStore.
Reference is preserved until notifySubscribers() is explicitly called.

#### Returns

[`WorkingWithDuckSnapshot`](../interfaces/WorkingWithDuckSnapshot.md)

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`getSnapshot`](../../arcade/core/engine/classes/ArcadeEngine.md#getsnapshot)

***

### init()

> **init**(): `void`

Initializes engine resources, object pools, and audio bindings.

#### Returns

`void`

#### Overrides

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`init`](../../arcade/core/engine/classes/ArcadeEngine.md#init)

***

### invalidateSnapshot()

> **invalidateSnapshot**(): `void`

Invalidates cached snapshot so the next getSnapshot() recomputes fresh state.

#### Returns

`void`

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`invalidateSnapshot`](../../arcade/core/engine/classes/ArcadeEngine.md#invalidatesnapshot)

***

### notifySubscribers()

> **notifySubscribers**(): `void`

Invalidates cached snapshot and broadcasts a state change to subscribers.

#### Returns

`void`

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`notifySubscribers`](../../arcade/core/engine/classes/ArcadeEngine.md#notifysubscribers)

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

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`on`](../../arcade/core/engine/classes/ArcadeEngine.md#on)

***

### performTrick()

> **performTrick**(`trick`): `void`

#### Parameters

##### trick

[`DuckTrick`](../type-aliases/DuckTrick.md)

#### Returns

`void`

***

### render()

> **render**(`ctx`, `_alpha`): `void`

Renders in-world graphics to the 2D canvas with sub-frame alpha interpolation.

#### Parameters

##### ctx

`CanvasRenderingContext2D`

##### \_alpha

`number`

#### Returns

`void`

#### Overrides

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`render`](../../arcade/core/engine/classes/ArcadeEngine.md#render)

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

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`resize`](../../arcade/core/engine/classes/ArcadeEngine.md#resize)

***

### subscribe()

> **subscribe**(`callback`): () => `void`

Subscribes a listener to snapshot state updates (React useSyncExternalStore).

#### Parameters

##### callback

() => `void`

#### Returns

() => `void`

#### Inherited from

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`subscribe`](../../arcade/core/engine/classes/ArcadeEngine.md#subscribe)

***

### update()

> **update**(`dt`): `void`

Advances deterministic simulation physics by fixed delta time dt (in seconds).

#### Parameters

##### dt

`number`

#### Returns

`void`

#### Overrides

[`ArcadeEngine`](../../arcade/core/engine/classes/ArcadeEngine.md).[`update`](../../arcade/core/engine/classes/ArcadeEngine.md#update)
