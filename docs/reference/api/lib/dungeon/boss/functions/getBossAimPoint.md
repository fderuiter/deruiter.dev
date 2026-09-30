[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/boss](../README.md) / getBossAimPoint

# Function: getBossAimPoint()

> **getBossAimPoint**(`boss`, `playerX`, `playerY`, `playerHeading?`): `object`

Picks the point a boss salvo aims at. With no heading it is the player's
tile; with one it is ahead of the player along that heading, by half the
distance to the boss (a shot takes longer to reach a far player), capped at
`BOSS_MAX_LEAD_TILES`.

## Parameters

### boss

`Pick`\<[`BossState`](../../types/interfaces/BossState.md), `"x"` \| `"y"`\>

The boss firing the salvo.

### playerX

`number`

The player's column.

### playerY

`number`

The player's row.

### playerHeading?

The player's last step, if they are moving.

#### dx

`number`

#### dy

`number`

## Returns

`object`

The grid point to aim at.

### x

> **x**: `number`

### y

> **y**: `number`
