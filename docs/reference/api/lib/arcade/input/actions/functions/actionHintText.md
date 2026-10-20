[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / actionHintText

# Function: actionHintText()

> **actionHintText**(`definition`): [`ActionHintText`](../interfaces/ActionHintText.md)

The hint text for an action on each kind of device. The keyboard reads
"Press" and the key label, a touch screen the action's `touchLabel` (by
default "Tap" and the label), and a gamepad "Press" and its button name,
falling back to the keyboard phrase when the action names no button. A
pointer action reads its touch phrase everywhere but the gamepad.

## Parameters

### definition

[`ActionDefinition`](../type-aliases/ActionDefinition.md)

The action.

## Returns

[`ActionHintText`](../interfaces/ActionHintText.md)

The key name and the phrase for each device.
