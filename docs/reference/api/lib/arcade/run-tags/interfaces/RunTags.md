[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / RunTags

# Interface: RunTags

How a run was played (#2547). Stored in the run snapshot and with a
game's best score.

## Properties

### assists

> `readonly` **assists**: `Readonly`\<`Record`\<`string`, [`AssistValue`](../type-aliases/AssistValue.md)\>\>

The assists the run has used, at the most generous setting it reached.
An assist at its least setting is left out, so an empty record is an
unassisted run.

***

### inputs

> `readonly` **inputs**: readonly [`InputModality`](../type-aliases/InputModality.md)[]

Every input the run was played with, in the order they were first used.

***

### views

> `readonly` **views**: readonly [`FormFactor`](../../form-factor/type-aliases/FormFactor.md)[]

Every view the run was played in, in the order they were first used.
