[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/working-with-duck-actions](../README.md) / DUCK\_ACTIONS

# Variable: DUCK\_ACTIONS

> `const` **DUCK\_ACTIONS**: [`ActionMap`](../../arcade/input/actions/interfaces/ActionMap.md)\<`"treat"` \| `"toy-1"` \| `"toy-2"` \| `"toy-3"` \| `"trick-sit"` \| `"trick-high-five"` \| `"trick-drop-it"` \| `"trick-spin"` \| `"space"` \| `"steer-up"` \| `"steer-down"` \| `"package"` \| `"pause"` \| `"escape"` \| `"drag-up"` \| `"drag-down"` \| `"drag-left"` \| `"drag-right"` \| `"drop"`\>

Everything the player can do in Working With Duck (#2356). The keyboard,
the gamepad and the touch dock all perform these actions, and the
cabinet's control list and the field manual's key column are generated
from them.

Keys are physical positions (`KeyboardEvent.code`). Two contexts share
keys: in the `park` the up and down keys (and W) steer Duck, and in the
`room` (the office and the bathtub) the arrows carry him and W asks for a
high five. Holding Space, a steer key or an arrow repeats it; the toys,
treats, tricks, the package and pause act once per press.
