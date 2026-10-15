[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/daily](../README.md) / arcadeDailyDateOfNumber

# Function: arcadeDailyDateOfNumber()

> **arcadeDailyDateOfNumber**(`seed`, `game`, `now`): `string` \| `null`

The date whose daily number `seed` is, checked against today and
yesterday at `now`, or null. Yesterday counts so a run started just before
midnight UTC still counts when it ends after.

## Parameters

### seed

`number`

### game

`"trial-and-error"` \| `"for-better-or-bulk"` \| `"study-director"` \| `"patty-drive-thru"` \| `"protocol-drift"`

### now

`number`

## Returns

`string` \| `null`
