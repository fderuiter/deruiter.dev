[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / CabinetCrtProfile

# Interface: CabinetCrtProfile

What the cabinet needs to know about a game to place its CRT layer.

## Properties

### gameDrawsCrt

> **gameDrawsCrt**: `boolean`

True when the game already draws its own CRT pass from the wizard's
setting or its own calibration, so the cabinet must not add a second one.

***

### surface

> **surface**: [`CabinetSurface`](../type-aliases/CabinetSurface.md)

Canvas games default to Soft; DOM games (cards, forms, text) to Off.
