[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / compareRunTags

# Function: compareRunTags()

> **compareRunTags**(`a`, `b`): `number`

Orders two records of the same score: an unassisted run first, then the
one with fewer assists, then by their JSON, so a merge that keeps the
better record is the same whichever copy it starts from.

## Parameters

### a

[`RunTags`](../interfaces/RunTags.md)

One record.

### b

[`RunTags`](../interfaces/RunTags.md)

The other.

## Returns

`number`

Negative when `a` is the better record, positive for `b`, 0 when equal.
