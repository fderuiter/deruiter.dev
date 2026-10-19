[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/retro-labyrinth/engine](../README.md) / RetroLabyrinthEngine

# Class: RetroLabyrinthEngine

Base abstract class and typed EventBus for all headless arcade game engines.
Zero framework dependencies. Testable in pure Node.js/Vitest.

## Extends

- [`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md)\<[`RetroLabyrinthState`](../interfaces/RetroLabyrinthState.md), [`RetroLabyrinthSnapshot`](../interfaces/RetroLabyrinthSnapshot.md)\>

## Constructors

### Constructor

> **new RetroLabyrinthEngine**(`config?`): `RetroLabyrinthEngine`

#### Parameters

##### config?

[`RetroLabyrinthConfig`](../interfaces/RetroLabyrinthConfig.md) = `{}`

#### Returns

`RetroLabyrinthEngine`

#### Overrides

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`constructor`](../../../arcade/core/engine/classes/ArcadeEngine.md#constructor)

## Properties

### cachedSnapshot

> `protected` **cachedSnapshot**: [`RetroLabyrinthSnapshot`](../interfaces/RetroLabyrinthSnapshot.md) \| `null` = `null`

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`cachedSnapshot`](../../../arcade/core/engine/classes/ArcadeEngine.md#cachedsnapshot)

***

### state

> `protected` **state**: [`RetroLabyrinthState`](../interfaces/RetroLabyrinthState.md)

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`state`](../../../arcade/core/engine/classes/ArcadeEngine.md#state)

## Methods

### createSnapshot()

> **createSnapshot**(): [`RetroLabyrinthSnapshot`](../interfaces/RetroLabyrinthSnapshot.md)

Generates a fresh immutable state snapshot.

#### Returns

[`RetroLabyrinthSnapshot`](../interfaces/RetroLabyrinthSnapshot.md)

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

### exportTelemetryCsv()

> **exportTelemetryCsv**(): `object`

#### Returns

`object`

##### combatCsv

> **combatCsv**: `string`

##### combinedCsv

> **combinedCsv**: `string`

##### stepsCsv

> **stepsCsv**: `string`

##### summaryCsv

> **summaryCsv**: `string`

***

### exportTelemetryJson()

> **exportTelemetryJson**(): `string`

#### Returns

`string`

***

### fireActiveWeapon()

> **fireActiveWeapon**(): `void`

#### Returns

`void`

***

### getSnapshot()

> **getSnapshot**(): [`RetroLabyrinthSnapshot`](../interfaces/RetroLabyrinthSnapshot.md)

Returns a cached immutable state snapshot for React useSyncExternalStore.
Reference is preserved until notifySubscribers() is explicitly called.

#### Returns

[`RetroLabyrinthSnapshot`](../interfaces/RetroLabyrinthSnapshot.md)

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`getSnapshot`](../../../arcade/core/engine/classes/ArcadeEngine.md#getsnapshot)

***

### getTelemetry()

> **getTelemetry**(): [`RunTelemetryData`](../../telemetry/interfaces/RunTelemetryData.md)

#### Returns

[`RunTelemetryData`](../../telemetry/interfaces/RunTelemetryData.md)

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

### loadCustomRoom()

> **loadCustomRoom**(`room`): `void`

#### Parameters

##### room

[`DungeonRoom`](../../../dungeon/types/interfaces/DungeonRoom.md)

#### Returns

`void`

***

### move()

> **move**(`dx`, `dy`): `boolean`

#### Parameters

##### dx

`number`

##### dy

`number`

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

### recordCombatAction()

> **recordCombatAction**(`action`): `void`

#### Parameters

##### action

`Partial`\<[`CombatActionEntry`](../../telemetry/interfaces/CombatActionEntry.md)\>

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

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`render`](../../../arcade/core/engine/classes/ArcadeEngine.md#render)

***

### resetGame()

> **resetGame**(): `void`

#### Returns

`void`

***

### resetTelemetry()

> **resetTelemetry**(): `void`

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

#### Inherited from

[`ArcadeEngine`](../../../arcade/core/engine/classes/ArcadeEngine.md).[`resize`](../../../arcade/core/engine/classes/ArcadeEngine.md#resize)

***

### selectWeapon()

> **selectWeapon**(`index`): `void`

#### Parameters

##### index

`number`

#### Returns

`void`

***

### setCrtTheme()

> **setCrtTheme**(`themeId`): `void`

#### Parameters

##### themeId

[`CRTThemeId`](../../../dungeon/types/type-aliases/CRTThemeId.md)

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
