[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / actionKeyLabel

# Function: actionKeyLabel()

> **actionKeyLabel**(`definition`): `string`

The keys of an action as players read them. An explicit `keyLabel` wins;
otherwise the distinct key names, joined with " / ".

## Parameters

### definition

[`ActionDefinition`](../type-aliases/ActionDefinition.md)

The action.

## Returns

`string`

The key label, or an empty string for an action with no keys.
