[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/prng](../README.md) / dailySeed

# Function: dailySeed()

> **dailySeed**(`utcDate`): `number`

The seed for one calendar day, by UTC date, so everyone who plays on the
same day gets the same events. It is always from 1 to MAX_SEED, so a daily
seed is never the standard day. Throws a RangeError for an invalid Date.

This is the game's Arcade Daily seed (#2113). The shared derivation keeps
this game's original salt, so every day's seed is the one it always was.

## Parameters

### utcDate

`Date`

## Returns

`number`
