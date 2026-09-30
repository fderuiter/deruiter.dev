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

### macro:execute

> **macro:execute**: [`MacroExecutePayload`](MacroExecutePayload.md)

Executes a saved macro by ID.

***

### macro:record\_step

> **macro:record\_step**: [`MacroRecordStepPayload`](MacroRecordStepPayload.md)

Records a single action step into the active macro recording.

***

### macro:save

> **macro:save**: [`MacroSavePayload`](MacroSavePayload.md)

Saves a named macro sequence to persistent browser storage.

***

### macro:start\_recording

> **macro:start\_recording**: \{ `name?`: `string`; \} \| `undefined`

Starts recording a new macro sequence.

***

### macro:state\_changed

> **macro:state\_changed**: [`MacroStatePayload`](MacroStatePayload.md)

Emitted whenever macro recording state changes.

***

### macro:stop\_recording

> **macro:stop\_recording**: `undefined`

Stops the active macro recording session.

***

### macro:toggle\_recording

> **macro:toggle\_recording**: \{ `name?`: `string`; \} \| `undefined`

Toggles macro recording mode on/off.

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

***

### workspace:execute\_action

> **workspace:execute\_action**: [`WorkspaceExecutePayload`](WorkspaceExecutePayload.md)

Triggers execution of a registered workspace action.

***

### workspace:register\_action

> **workspace:register\_action**: [`WorkspaceActionPayload`](WorkspaceActionPayload.md)

Registers a sub-tool contextual workspace action.

***

### workspace:unregister\_action

> **workspace:unregister\_action**: [`WorkspaceUnregisterPayload`](WorkspaceUnregisterPayload.md)

Unregisters a sub-tool contextual workspace action.
