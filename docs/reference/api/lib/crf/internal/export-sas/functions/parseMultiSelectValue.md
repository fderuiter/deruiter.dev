[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/export-sas](../README.md) / parseMultiSelectValue

# Function: parseMultiSelectValue()

> **parseMultiSelectValue**(`edcValue`, `optionCode`): `"Y"` \| `"N"`

Parses a comma-separated multi-select EDC response string
and checks whether a specific option code is selected.
Returns 'Y' if selected, 'N' if absent/unselected.

## Parameters

### edcValue

`string` \| `boolean` \| `string`[] \| `null` \| `undefined`

### optionCode

`string`

## Returns

`"Y"` \| `"N"`
