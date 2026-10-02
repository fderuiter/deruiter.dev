[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/scoring](../README.md) / computeRoomExitScore

# Function: computeRoomExitScore()

> **computeRoomExitScore**(`scoreBeforeExit`, `moves`, `roomCryptoEarned`): `number`

The score after reaching a room's exit: the score so far, a speed bonus of
1000 less 20 per move (at least `MIN_EXIT_SPEED_BONUS`), and the crypto
earned in this room only. Crypto carried in from earlier rooms, or spent at
the Market, does not change the bonus, so each coin scores once.

## Parameters

### scoreBeforeExit

`number`

The score when the player steps onto the exit.

### moves

`number`

Moves taken in this room, including the exit step.

### roomCryptoEarned

`number`

Crypto earned in this room.

## Returns

`number`

The score to show on the room-cleared screen.
