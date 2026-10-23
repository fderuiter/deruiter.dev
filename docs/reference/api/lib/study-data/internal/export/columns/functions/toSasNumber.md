[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/columns](../README.md) / toSasNumber

# Function: toSasNumber()

> **toSasNumber**(`storage`, `value`): `number`

Converts a complete ISO 8601 value to its SAS numeric form.

## Parameters

### storage

`"sas-date"` \| `"sas-datetime"` \| `"sas-time"`

### value

`string`

## Returns

`number`

## Throws

RangeError when the value is partial or not a real date or time.
