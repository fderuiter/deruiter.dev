[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/arcade-engine](../README.md) / ClinicalTrialChaosEngine

# Class: ClinicalTrialChaosEngine

Event-emitting wrapper around the Clinical Trial Chaos shift rules. Every
rule it applies comes from the same pure functions the player-facing
component uses (#901); this class only holds the state and emits events.

## Extends

- [`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md)\<[`ClinicalTrialChaosState`](../interfaces/ClinicalTrialChaosState.md), [`ClinicalTrialChaosSnapshot`](../interfaces/ClinicalTrialChaosSnapshot.md)\>

## Constructors

### Constructor

> **new ClinicalTrialChaosEngine**(`initialProtocol?`): `ClinicalTrialChaosEngine`

#### Parameters

##### initialProtocol?

[`StudyProtocol`](../../../crf/types/interfaces/StudyProtocol.md) \| `null`

#### Returns

`ClinicalTrialChaosEngine`

#### Overrides

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`constructor`](../../../arcade/core/engine/classes/ArcadeEngine.md#constructor)

## Properties

### cachedSnapshot

> `protected` **cachedSnapshot**: [`ClinicalTrialChaosSnapshot`](../interfaces/ClinicalTrialChaosSnapshot.md) \| `null` = `null`

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`cachedSnapshot`](../../../arcade/core/engine/classes/ArcadeEngine.md#cachedsnapshot)

***

### state

> `protected` **state**: [`ClinicalTrialChaosState`](../interfaces/ClinicalTrialChaosState.md)

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`state`](../../../arcade/core/engine/classes/ArcadeEngine.md#state)

## Methods

### activatePowerUp()

> **activatePowerUp**(`id`, `force?`): `void`

#### Parameters

##### id

[`PowerUpType`](../../types/type-aliases/PowerUpType.md)

##### force?

`boolean` = `true`

#### Returns

`void`

***

### addAuditLog()

> **addAuditLog**(`message`, `level?`, `suspicionDelta?`): `void`

#### Parameters

##### message

`string`

##### level?

`"INFO"` \| `"WARN"` \| `"CRITICAL"` \| `"COMPLIANT"`

##### suspicionDelta?

`number` = `0`

#### Returns

`void`

***

### addSubject()

> **addSubject**(`subject`): `void`

#### Parameters

##### subject

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

#### Returns

`void`

***

### createSnapshot()

> **createSnapshot**(): [`ClinicalTrialChaosSnapshot`](../interfaces/ClinicalTrialChaosSnapshot.md)

Generates a fresh immutable state snapshot.

#### Returns

[`ClinicalTrialChaosSnapshot`](../interfaces/ClinicalTrialChaosSnapshot.md)

#### Overrides

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`createSnapshot`](../../../arcade/core/engine/classes/ArcadeEngine.md#createsnapshot)

***

### destroy()

> **destroy**(): `void`

Cleans up engine timers, event subscriptions, and resources.

#### Returns

`void`

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`destroy`](../../../arcade/core/engine/classes/ArcadeEngine.md#destroy)

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

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`emit`](../../../arcade/core/engine/classes/ArcadeEngine.md#emit)

***

### getSnapshot()

> **getSnapshot**(): [`ClinicalTrialChaosSnapshot`](../interfaces/ClinicalTrialChaosSnapshot.md)

Returns a cached immutable state snapshot for React useSyncExternalStore.
Reference is preserved until notifySubscribers() is explicitly called.

#### Returns

[`ClinicalTrialChaosSnapshot`](../interfaces/ClinicalTrialChaosSnapshot.md)

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`getSnapshot`](../../../arcade/core/engine/classes/ArcadeEngine.md#getsnapshot)

***

### init()

> **init**(): `void`

Initializes engine resources, object pools, and audio bindings.

#### Returns

`void`

#### Overrides

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`init`](../../../arcade/core/engine/classes/ArcadeEngine.md#init)

***

### invalidateSnapshot()

> **invalidateSnapshot**(): `void`

Invalidates cached snapshot so the next getSnapshot() recomputes fresh state.

#### Returns

`void`

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`invalidateSnapshot`](../../../arcade/core/engine/classes/ArcadeEngine.md#invalidatesnapshot)

***

### isModalPaused()

> **isModalPaused**(): `boolean`

#### Returns

`boolean`

***

### notifySubscribers()

> **notifySubscribers**(): `void`

Invalidates cached snapshot and broadcasts a state change to subscribers.

#### Returns

`void`

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`notifySubscribers`](../../../arcade/core/engine/classes/ArcadeEngine.md#notifysubscribers)

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

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`on`](../../../arcade/core/engine/classes/ArcadeEngine.md#on)

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

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`render`](../../../arcade/core/engine/classes/ArcadeEngine.md#render)

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

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`resize`](../../../arcade/core/engine/classes/ArcadeEngine.md#resize)

***

### resolveObservation()

> **resolveObservation**(`subjectId`, `obsId`, `choice`): `object`

#### Parameters

##### subjectId

`string`

##### obsId

`string`

##### choice

`string`

#### Returns

`object`

##### explanation

> **explanation**: `string`

##### isValid

> **isValid**: `boolean`

***

### setModalPause()

> **setModalPause**(`paused`): `void`

#### Parameters

##### paused

`boolean`

#### Returns

`void`

***

### setPaused()

> **setPaused**(`paused`): `void`

#### Parameters

##### paused

`boolean`

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

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`subscribe`](../../../arcade/core/engine/classes/ArcadeEngine.md#subscribe)

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

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`update`](../../../arcade/core/engine/classes/ArcadeEngine.md#update)

***

### verifyAndSubmit()

> **verifyAndSubmit**(`subjectId`, `reason`, `targetStation`): `object`

#### Parameters

##### subjectId

`string`

##### reason

`string`

##### targetStation

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

#### Returns

`object`

##### logMessage

> **logMessage**: `string`

##### success

> **success**: `boolean`
