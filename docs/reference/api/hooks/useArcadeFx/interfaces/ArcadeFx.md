[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useArcadeFx](../README.md) / ArcadeFx

# Interface: ArcadeFx

Feedback effects returned by [useArcadeFx](../functions/useArcadeFx.md).

## Properties

### flash

> **flash**: (`color?`) => `void`

Briefly shows the flash overlay in `color`.

#### Parameters

##### color?

`string`

#### Returns

`void`

***

### flashRef

> **flashRef**: `RefObject`\<`HTMLDivElement` \| `null`\>

Attach to an absolutely positioned overlay inside the stage with
`opacity: 0` and `pointer-events: none`. Flash fades it in and out.

***

### hitStop

> **hitStop**: (`ms`) => `void`

Freezes the game for `ms` milliseconds; read it with `isHitStopped`.

#### Parameters

##### ms

`number`

#### Returns

`void`

***

### isHitStopped

> **isHitStopped**: () => `boolean`

True while a hit stop is running. Call it from the game loop.

#### Returns

`boolean`

***

### shake

> **shake**: (`px`) => `void`

Shakes the stage by up to `px` CSS pixels, scaled by the Setup Wizard's
screen shake setting and capped at [ARCADE\_FX\_MAX\_SHAKE\_PX](../variables/ARCADE_FX_MAX_SHAKE_PX.md).

#### Parameters

##### px

`number`

#### Returns

`void`

***

### stageRef

> **stageRef**: `RefObject`\<`HTMLDivElement` \| `null`\>

Attach to the element that shakes, usually the canvas wrapper.
