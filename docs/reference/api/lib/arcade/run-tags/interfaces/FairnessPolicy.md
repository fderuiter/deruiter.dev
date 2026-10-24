[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / FairnessPolicy

# Interface: FairnessPolicy

A game's assist table: what each input gets, and the order of each
assist's settings from least to most generous.

## Properties

### assistsFor

> `readonly` **assistsFor**: (`input`) => `Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

The assists an input gets. An assist left out is at its first level.

#### Parameters

##### input

[`InputModality`](../type-aliases/InputModality.md)

#### Returns

`Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

***

### levels

> `readonly` **levels**: `Readonly`\<`Record`\<`string`, readonly [`AssistValue`](../type-aliases/AssistValue.md)[]\>\>

Each assist's settings, least generous first. The first is "no assist",
e.g. `{ aimAssist: ["off", "light", "strong"], autoFire: [false, true] }`.
