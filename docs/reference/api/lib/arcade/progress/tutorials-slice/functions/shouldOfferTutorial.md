[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/tutorials-slice](../README.md) / shouldOfferTutorial

# Function: shouldOfferTutorial()

> **shouldOfferTutorial**(`record`, `version`): `boolean`

Whether a game's tutorial should be offered when its cabinet launches:
true until the player finishes or turns down this version of it.

## Parameters

### record

[`TutorialRecord`](../interfaces/TutorialRecord.md) \| `undefined`

The game's record, if any.

### version

`number`

The script's current version.

## Returns

`boolean`

True when the offer should show.
