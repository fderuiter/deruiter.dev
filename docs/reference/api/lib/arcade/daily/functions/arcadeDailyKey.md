[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/daily](../README.md) / arcadeDailyKey

# Function: arcadeDailyKey()

> **arcadeDailyKey**(`date`, `game`): `string`

The text a game's daily seed is derived from. Each game has its own salt so
every game's daily differs. Trial & Error and For Better or Bulk keep the
salts their dailies used before the Arcade Daily, so their past and future
daily links still give the same seeds.

## Parameters

### date

`string`

### game

`"trial-and-error"` \| `"for-better-or-bulk"` \| `"study-director"` \| `"patty-drive-thru"` \| `"protocol-drift"`

## Returns

`string`
