[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / StageFit

# Interface: StageFit

Where the canvas goes and how big its backing store is.

## Properties

### backingHeight

> **backingHeight**: `number`

***

### backingWidth

> **backingWidth**: `number`

Backing-store size, in device pixels.

***

### cssHeight

> **cssHeight**: `number`

***

### cssWidth

> **cssWidth**: `number`

CSS size the canvas is shown at. Never larger than the slot.

***

### dpr

> **dpr**: `number`

The device pixel ratio after the cap.

***

### scale

> **scale**: `number`

Backing-store pixels per game unit (a whole number in `integer` mode).

***

### step

> **step**: `number`

The CSS width step the box snapped to (`fractional` mode), or 0.
