[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/working-with-duck-engine](../README.md) / endlessPace

# Function: endlessPace()

> **endlessPace**(`quarter`, `baseLevel?`): [`DuckEndlessPace`](../interfaces/DuckEndlessPace.md)

The pace of an endless quarter. Quarter 1 plays at the base sprint's
rates; each later quarter raises the meter rates, shortens the impulse
interval and adds one hazard. Past Y2 the climb eases toward a ceiling
rather than stopping, so a long run keeps getting harder (#2328).

## Parameters

### quarter

`number`

### baseLevel?

`number` = `5`

## Returns

[`DuckEndlessPace`](../interfaces/DuckEndlessPace.md)
