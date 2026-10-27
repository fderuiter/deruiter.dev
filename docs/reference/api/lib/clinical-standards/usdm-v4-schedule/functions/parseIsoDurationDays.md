[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-schedule](../README.md) / parseIsoDurationDays

# Function: parseIsoDurationDays()

> **parseIsoDurationDays**(`value`): `number` \| `null`

Converts an ISO 8601 duration such as `P14D`, `P2W` or `-P3D` into a whole
number of days. Years count as 365 days and months as 30; hours, minutes
and seconds are rounded to the nearest day. Returns `null` for anything
that is not an ISO 8601 duration.

## Parameters

### value

`unknown`

## Returns

`number` \| `null`
