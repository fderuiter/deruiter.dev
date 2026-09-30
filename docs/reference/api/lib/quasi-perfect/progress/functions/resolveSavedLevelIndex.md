[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / resolveSavedLevelIndex

# Function: resolveSavedLevelIndex()

> **resolveSavedLevelIndex**(`progress`, `levels`): `number`

Choose the level index the puzzler opens on from saved progress.

A saved integer index inside the campaign is restored. A missing index
opens the first level that is not yet completed (Level 1 when none is
done, or when every level is). A corrupt or out-of-range index, or
progress that is not an object, opens Level 1. It never throws.

## Parameters

### progress

`unknown`

The parsed saved progress, of unknown shape.

### levels

readonly `object`[]

The campaign levels in order; only `id` is read.

## Returns

`number`

A valid index into `levels`.
