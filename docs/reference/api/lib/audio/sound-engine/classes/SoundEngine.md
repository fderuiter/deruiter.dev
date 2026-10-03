[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/audio/sound-engine](../README.md) / SoundEngine

# Class: SoundEngine

## Constructors

### Constructor

> **new SoundEngine**(`options?`): `SoundEngine`

#### Parameters

##### options?

[`SoundEngineOptions`](../interfaces/SoundEngineOptions.md) = `{}`

#### Returns

`SoundEngine`

## Methods

### close()

> **close**(): `void`

Closes and disposes of AudioContext resources.

#### Returns

`void`

***

### getAudioContext()

> **getAudioContext**(): `AudioContext` \| `null`

Lazily resolves or instantiates the active AudioContext.

#### Returns

`AudioContext` \| `null`

***

### getOutputTap()

> **getOutputTap**(): `AudioNode` \| `null`

Returns the node set with [SoundEngine.setOutputTap](#setoutputtap), or null.

#### Returns

`AudioNode` \| `null`

***

### getVolume()

> **getVolume**(): `number`

Returns current master volume (0.0 to 1.0).

#### Returns

`number`

***

### isBypassActive()

> **isBypassActive**(): `boolean`

Checks if user has enabled OS or browser-level accessibility bypasses
(e.g. forced-colors, high-contrast, or prefers-reduced-motion).

#### Returns

`boolean`

***

### isMuted()

> **isMuted**(): `boolean`

Returns current mute status.

#### Returns

`boolean`

***

### isSoundAllowed()

> **isSoundAllowed**(): `boolean`

Returns whether sound playback is currently permitted.

#### Returns

`boolean`

***

### playNoise()

> **playNoise**(`options`): `void`

Synthesizes and plays procedural white noise with optional filter resonance.

#### Parameters

##### options

[`NoiseOptions`](../interfaces/NoiseOptions.md)

#### Returns

`void`

***

### playSequence()

> **playSequence**(`notes`, `options?`): [`SequenceHandle`](../interfaces/SequenceHandle.md)

Plays an ordered sequence or arpeggio of notes.

#### Parameters

##### notes

[`SequenceNote`](../interfaces/SequenceNote.md)[]

##### options?

[`SequenceOptions`](../interfaces/SequenceOptions.md) = `{}`

#### Returns

[`SequenceHandle`](../interfaces/SequenceHandle.md)

***

### playTone()

#### Call Signature

> **playTone**(`options`): `void`

Synthesizes and plays a customizable frequency pulse.

##### Parameters

###### options

[`ToneOptions`](../interfaces/ToneOptions.md)

##### Returns

`void`

#### Call Signature

> **playTone**(`frequency`, `duration?`, `type?`, `volume?`, `pan?`): `void`

Synthesizes and plays a customizable frequency pulse.

##### Parameters

###### frequency

`number`

###### duration?

`number`

###### type?

`OscillatorType`

###### volume?

`number`

###### pan?

`number`

##### Returns

`void`

***

### setMuted()

> **setMuted**(`muted`): `void`

Sets mute status, persists to storage, and halts active audio on mute.

#### Parameters

##### muted

`boolean`

#### Returns

`void`

***

### setOutputTap()

> **setOutputTap**(`node`): `void`

Routes every sound played after this call through `node` instead of
straight to the speakers, so a visualizer can read the mixed output. The
caller owns `node` and must connect it onward to the destination; pass
null to restore direct output. A tap from a different AudioContext is
ignored, so a stale node can never swallow sound.

#### Parameters

##### node

`AudioNode` \| `null`

The node sounds connect to, such as an AnalyserNode, or
  null to remove the tap.

#### Returns

`void`

***

### setVolume()

> **setVolume**(`v`): `void`

Sets master volume, clamps between 0 and 1, and persists to storage.

#### Parameters

##### v

`number`

#### Returns

`void`

***

### stopAll()

> **stopAll**(): `void`

Immediately halts all active playing oscillators, noise sources, and sequence timers.

#### Returns

`void`

***

### toggleMute()

> **toggleMute**(): `boolean`

Toggles mute status and returns the next value.

#### Returns

`boolean`

***

### trackSource()

> **trackSource**\<`T`\>(`source`): `T`

Tracks an active audio source node for unified lifecycle governance and immediate stopAll() termination.

#### Type Parameters

##### T

`T` *extends* `AudioScheduledSourceNode`

#### Parameters

##### source

`T`

#### Returns

`T`
