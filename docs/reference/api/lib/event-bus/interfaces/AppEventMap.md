[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/event-bus](../README.md) / AppEventMap

# Interface: AppEventMap

Registry of application events, mapping each event name to the type of its
`detail` payload. An event whose payload type includes `undefined` may be
emitted without a detail.

## Properties

### crt-calibration-changed

> **crt-calibration-changed**: `undefined`

The arcade CRT calibration was saved.

***

### meme\_achievement\_unlocked

> **meme\_achievement\_unlocked**: `object`

A Meme Vault achievement was unlocked for the first time.

#### id

> **id**: `string`

***

### meme\_vault\_unlocked\_change

> **meme\_vault\_unlocked\_change**: `object`

The Meme Vault unlocked flag was written.

#### unlocked

> **unlocked**: `boolean`

***

### open-photo-gallery

> **open-photo-gallery**: \{ `photoId?`: `string`; \} \| `undefined`

Opens the global photo gallery, optionally at a specific photo.

***

### terminal:run

> **terminal:run**: `object`

Asks the on-page sandbox terminal to type and run a command.

#### command

> **command**: `string`

***

### trigger\_retro\_chaos

> **trigger\_retro\_chaos**: `undefined`

Opens the Retro Chaos overlay from a shortcut (Command Palette, terminal, Meme Vault).
