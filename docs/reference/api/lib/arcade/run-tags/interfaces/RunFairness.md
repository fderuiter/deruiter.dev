[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / RunFairness

# Interface: RunFairness

A run's record as a small external store, for a session to hold (#2547).
The view and input are noted as they change; the record ratchets, and
[RunFairness.assists](#assists) is the tuning to play with.

## Properties

### assists

> `readonly` **assists**: () => `Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

The tuning to play with now, from [runAssists](../functions/runAssists.md).

#### Returns

`Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

***

### getTags

> `readonly` **getTags**: () => [`RunTags`](RunTags.md)

The run's record. Returns the same object until it changes.

#### Returns

[`RunTags`](RunTags.md)

***

### noteInput

> `readonly` **noteInput**: (`input`) => `void`

Notes the input the player is using now, and ratchets the assists.

#### Parameters

##### input

[`InputModality`](../type-aliases/InputModality.md)

#### Returns

`void`

***

### noteView

> `readonly` **noteView**: (`view`) => `void`

Notes the view the run is in now.

#### Parameters

##### view

[`FormFactor`](../../form-factor/type-aliases/FormFactor.md)

#### Returns

`void`

***

### policy

> `readonly` **policy**: [`FairnessPolicy`](FairnessPolicy.md)

The game's assist table.

***

### reset

> `readonly` **reset**: () => `void`

Starts a new run's record in the view and input in use now.

#### Returns

`void`

***

### restore

> `readonly` **restore**: (`tags`) => `void`

Puts back a saved run's record on Resume, then notes the view and
input in use now, so the resumed run keeps its ratchet and records
how it carries on.

#### Parameters

##### tags

[`RunTags`](RunTags.md)

#### Returns

`void`

***

### subscribe

> `readonly` **subscribe**: (`listener`) => () => `void`

Calls `listener` after every change. Returns an unsubscribe.

#### Parameters

##### listener

() => `void`

#### Returns

() => `void`
