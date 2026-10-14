[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/presets](../README.md) / WeekDayPreset

# Interface: WeekDayPreset

## Properties

### ageUnlocked?

> `readonly` `optional` **ageUnlocked?**: `boolean`

True on the day the player turns eighteen and coffee unlocks.

***

### blurb

> `readonly` **blurb**: `string`

One line, in the diary's voice, for the day picker and the diary page.

***

### dials

> `readonly` **dials**: [`ShiftScenario`](../../types/interfaces/ShiftScenario.md)

***

### id

> `readonly` **id**: [`WeekdayId`](../../types/type-aliases/WeekdayId.md)

***

### label

> `readonly` **label**: `string`

The weekday, such as "Monday".

***

### rushWindows?

> `readonly` `optional` **rushWindows?**: readonly [`RushWindow`](../../types/type-aliases/RushWindow.md)[]

The day's rushes; left out, the standard lunch rush.

***

### title

> `readonly` **title**: `string`

What kind of day it is, such as "Fry Friday".
