[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/tutorials-slice](../README.md) / setTutorialOutcome

# Function: setTutorialOutcome()

> **setTutorialOutcome**(`gameId`, `version`, `outcome`): `boolean`

Records how a game's tutorial ended.

## Parameters

### gameId

`string`

The game's registry slug.

### version

`number`

The script version.

### outcome

[`TutorialOutcome`](../type-aliases/TutorialOutcome.md)

Finished, or turned down.

## Returns

`boolean`

True when the record reached localStorage.
