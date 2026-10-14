[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / readDeck

# Function: readDeck()

> **readDeck**(`value`): `Record`\<`string`, `number`\> \| `undefined`

Reads a saved run's deck strictly: only events that can be dealt, on whole
days from 1. Anything that is not a deck reads as none, so the run plays
on the fixed days, as a save from before #2093 does.

## Parameters

### value

`unknown`

## Returns

`Record`\<`string`, `number`\> \| `undefined`
