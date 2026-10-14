[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / isAgeLocked

# Function: isAgeLocked()

> **isAgeLocked**(`itemId`, `config?`): `boolean`

True when the item needs someone 18 or older to make it. Pass the shift's
config to account for the birthday: once `ageUnlocked` is set, nothing is
locked (#2086).

## Parameters

### itemId

[`MenuItemId`](../../../types/type-aliases/MenuItemId.md)

### config?

`Pick`\<[`ShiftConfig`](../../../types/interfaces/ShiftConfig.md), `"ageUnlocked"`\>

## Returns

`boolean`
