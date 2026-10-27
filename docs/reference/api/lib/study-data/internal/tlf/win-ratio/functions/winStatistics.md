[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/win-ratio](../README.md) / winStatistics

# Function: winStatistics()

> **winStatistics**(`subjects`, `options`): [`WinRatioResult`](../../../../types/interfaces/WinRatioResult.md)

Win ratio, net benefit and win odds for a hierarchical composite
endpoint, with confidence limits and z tests, and the
Finkelstein-Schoenfeld test.

Pairs are formed only within a stratum. Under `"unstratified"` every
subject is in one stratum whatever its label. A subject's missing
outcome on a component ties with everyone on that component, so the
pair moves on to the next one.

Estimates whose denominator is zero (no losses for the win ratio) and
variances that cannot be formed (fewer than two subjects in a group of
some stratum) are reported as `null`.

## Parameters

### subjects

readonly [`WinRatioSubject`](../../../../types/interfaces/WinRatioSubject.md)[]

The analysis subjects, both groups.

### options

[`WinRatioOptions`](../../../../types/interfaces/WinRatioOptions.md)

The hierarchy and the settings.

## Returns

[`WinRatioResult`](../../../../types/interfaces/WinRatioResult.md)

## Throws

RangeError when the hierarchy or the subjects are malformed, or
  either group is empty.
