[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / getActProgressReadout

# Function: getActProgressReadout()

> **getActProgressReadout**(`actKills`, `requiredKills`, `boss`): [`ActProgressReadout`](../interfaces/ActProgressReadout.md)

The act's progress for the HUD: kills against the quota, clamped so a
minion shot during the boss fight never reads 12/8, then the boss's HP
once it is up.

## Parameters

### actKills

`number`

Minion kills this act.

### requiredKills

`number`

The act's minion quota.

### boss

Whether the boss is up, and its HP.

#### active

`boolean`

#### hp

`number`

#### maxHp

`number`

## Returns

[`ActProgressReadout`](../interfaces/ActProgressReadout.md)
