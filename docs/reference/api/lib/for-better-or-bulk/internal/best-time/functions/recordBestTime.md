[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/best-time](../README.md) / recordBestTime

# Function: recordBestTime()

> **recordBestTime**(`times`, `setup`, `finishedAt`): `object`

Records a finished day's time against the stored bests. The returned times
hold the new best when the day beat the old one, and are the same object
otherwise, so a caller can skip the write.

## Parameters

### times

[`BestTimes`](../../../types/type-aliases/BestTimes.md)

### setup

[`Setup`](../../../types/interfaces/Setup.md)

### finishedAt

`number`

## Returns

`object`

### record

> `readonly` **record**: [`BestTimeRecord`](../../../types/interfaces/BestTimeRecord.md)

### times

> `readonly` **times**: [`BestTimes`](../../../types/type-aliases/BestTimes.md)
