[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-powerups](../README.md) / Pickup

# Interface: Pickup

A power-up travelling the course. Positions are world pixels, like the
course features; `x` is the left edge and `y` the top.

## Properties

### emergeMs

> **emergeMs**: `number`

Time left rising out of its block; it doesn't move or fall until 0.

***

### id

> **id**: `number`

***

### kind

> **kind**: [`PickupKind`](../type-aliases/PickupKind.md)

***

### vx

> **vx**: `number`

World pixels per 60 Hz frame; positive moves away from the runner.

***

### vy

> **vy**: `number`

***

### x

> **x**: `number`

***

### y

> **y**: `number`
