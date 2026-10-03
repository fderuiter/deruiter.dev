[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/prompts](../README.md) / SetupPrompter

# Interface: SetupPrompter

Everything the setup framework asks a person. Implementations decide how:
the terminal prompter reads from a TTY, the non-interactive prompter never
blocks and answers every question with its safe default.

## Properties

### interactive

> `readonly` **interactive**: `boolean`

False when no person can answer; callers treat missing answers as manual work.

## Methods

### choose()

> **choose**\<`T`\>(`question`, `choices`, `fallback`): `Promise`\<`T`\>

Pick one of `choices`; returns `fallback` on empty input.

#### Type Parameters

##### T

`T` *extends* `string`

#### Parameters

##### question

`string`

##### choices

readonly `T`[]

##### fallback

`T`

#### Returns

`Promise`\<`T`\>

***

### confirm()

> **confirm**(`question`, `defaultYes?`): `Promise`\<`boolean`\>

Yes/no question. `defaultYes` decides what Enter means.

#### Parameters

##### question

`string`

##### defaultYes?

`boolean`

#### Returns

`Promise`\<`boolean`\>

***

### input()

> **input**(`question`): `Promise`\<`string`\>

Visible free-text input. Returns "" when nothing was entered.

#### Parameters

##### question

`string`

#### Returns

`Promise`\<`string`\>

***

### secret()

> **secret**(`question`): `Promise`\<`string`\>

Hidden input for secrets: nothing typed is echoed.

#### Parameters

##### question

`string`

#### Returns

`Promise`\<`string`\>
