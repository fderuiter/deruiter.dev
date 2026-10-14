[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/best-time](../README.md) / bestTimeKey

# Function: bestTimeKey()

> **bestTimeKey**(`setup`): `string`

The key a setup's best time is kept under. Each timer has its own best,
each seeded day has its own best, and each plan has its own, so a lighter
cart never sets a time a heavier one is measured against. The helper and
the controls are not part of the key: helper days do not set a best.

## Parameters

### setup

[`Setup`](../../../types/interfaces/Setup.md)

## Returns

`string`
