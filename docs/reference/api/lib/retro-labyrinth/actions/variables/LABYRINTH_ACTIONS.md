[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/retro-labyrinth/actions](../README.md) / LABYRINTH\_ACTIONS

# Variable: LABYRINTH\_ACTIONS

> `const` **LABYRINTH\_ACTIONS**: [`ActionMap`](../../../arcade/input/actions/interfaces/ActionMap.md)\<`"move-up"` \| `"move-down"` \| `"move-left"` \| `"move-right"` \| `"tool-1"` \| `"tool-2"` \| `"tool-3"` \| `"tool-4"` \| `"tool-5"` \| `"emp"` \| `"exploit"` \| `"market"` \| `"crt"` \| `"pause"` \| `"escape"` \| `"confirm"` \| `"retry"`\>

Everything the player can do in Retro Labyrinth (#2376). Keys, the gamepad
and the touch docks all perform these actions, and the cabinet's control
list and the field manual's key column are generated from them, so neither
can drift from the bindings again (the control list said "1-3" while the
game read 1 to 5).

Keys are physical positions (`KeyboardEvent.code`). The moves, tools, EMP,
Market and scanlines act only while the room is playing (`run`); Enter and
R answer the cards (`card`). A held move key repeats at the keyboard's own
rate. Pause takes P and Escape in every context, and still acts on a
focused button, so the pause card's own buttons never trap it.
