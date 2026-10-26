[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/device-settings-slice](../README.md) / effectiveLayout

# Function: effectiveLayout()

> **effectiveLayout**(`layout`, `width`): [`DeviceLayout`](../type-aliases/DeviceLayout.md)

The layout the cabinet uses: the stored choice while it fits, and `auto`
while it does not. The stored choice is kept, so it applies again once
the window is wide enough.

## Parameters

### layout

[`DeviceLayout`](../type-aliases/DeviceLayout.md)

The stored layout.

### width

`number`

The window's width in CSS px.

## Returns

[`DeviceLayout`](../type-aliases/DeviceLayout.md)

The layout to use now.
