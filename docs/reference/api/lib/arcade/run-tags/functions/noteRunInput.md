[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / noteRunInput

# Function: noteRunInput()

> **noteRunInput**(`tags`, `input`, `policy`): [`RunTags`](../interfaces/RunTags.md)

Records an input change, and ratchets the assists: an input with more
generous assists loosens the run, and one with fewer never tightens it.

## Parameters

### tags

[`RunTags`](../interfaces/RunTags.md)

The run so far.

### input

[`InputModality`](../type-aliases/InputModality.md)

The input the player is now using.

### policy

[`FairnessPolicy`](../interfaces/FairnessPolicy.md)

The game's assist table.

## Returns

[`RunTags`](../interfaces/RunTags.md)

The record, or `tags` itself when nothing changed.
