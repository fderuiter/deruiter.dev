[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/escalation](../README.md) / addOpenedStations

# Function: addOpenedStations()

> **addOpenedStations**\<`T`\>(`current`, `target`): `T`[]

Adds stations a new Audit Year opened to the live floor. Stations already
open keep their position (a scramble survives) and their counts; each new
one takes the next free position.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### current

readonly `T`[]

Stations on the floor now.

### target

readonly `T`[]

Stations the new year opens, from `getStationsForPhase`.

## Returns

`T`[]

The floor with any new stations appended.
