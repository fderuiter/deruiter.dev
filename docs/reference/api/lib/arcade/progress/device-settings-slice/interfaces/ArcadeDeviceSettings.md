[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/device-settings-slice](../README.md) / ArcadeDeviceSettings

# Interface: ArcadeDeviceSettings

This device's cabinet settings.

## Properties

### dockSize

> `readonly` **dockSize**: [`DeviceDockSize`](../type-aliases/DeviceDockSize.md)

***

### handedness

> `readonly` **handedness**: [`DeviceHandedness`](../type-aliases/DeviceHandedness.md)

***

### haptics

> `readonly` **haptics**: `boolean`

Whether games may vibrate; a device without the API ignores it.

***

### layout

> `readonly` **layout**: [`DeviceLayout`](../type-aliases/DeviceLayout.md)

***

### music

> `readonly` **music**: `number`

Music volume, 0 to 1.

***

### reducedEffects

> `readonly` **reducedEffects**: `boolean`

Fewer effects, on top of `prefers-reduced-motion`.

***

### sound

> `readonly` **sound**: `number`

Sound effects volume, 0 to 1.

***

### version

> `readonly` **version**: `1`
