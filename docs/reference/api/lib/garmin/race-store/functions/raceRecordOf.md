[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/race-store](../README.md) / raceRecordOf

# Function: raceRecordOf()

> **raceRecordOf**(`place`, `timeMs`, `priorBestMs`): `"CR"` \| `"PR"` \| `null`

The record a result earns on its board, which holds this device's times
only: PR when it beats the board's best before it (a new personal record,
which is also the course record), CR when it sets the first record on an
empty board, otherwise null.

## Parameters

### place

`number`

### timeMs

`number`

### priorBestMs

`number` \| `null`

## Returns

`"CR"` \| `"PR"` \| `null`
