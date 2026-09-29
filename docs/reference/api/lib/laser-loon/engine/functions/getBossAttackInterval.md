[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / getBossAttackInterval

# Function: getBossAttackInterval()

> **getBossAttackInterval**(`actNumber`, `bossPhase?`): `number`

Frames between a boss's volleys: shorter in later acts, and shorter again
once the boss drops below half HP.

## Parameters

### actNumber

`number`

The act being played.

### bossPhase?

`number` = `1`

1 above half HP, 2 at or below it.

## Returns

`number`
