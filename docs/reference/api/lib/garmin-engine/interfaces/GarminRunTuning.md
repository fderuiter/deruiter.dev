[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / GarminRunTuning

# Interface: GarminRunTuning

Engine parameters a run is tuned with. Every field is a plain multiplier or
constant so the effect of a setup choice is directly testable.

## Properties

### allocIntervalScale

> **allocIntervalScale**: `number`

Multiplies the gap between automatic heap allocations (larger is easier).

***

### batteryDrainScale

> **batteryDrainScale**: `number`

Multiplies battery drain (base and backlight).

***

### gcBonusFreedKb

> **gcBonusFreedKb**: `number`

Extra kilobytes a garbage collection frees on top of its base 2 to 4 KB.

***

### gcFreezeMs

> **gcFreezeMs**: `number`

Length of the garbage-collection freeze in milliseconds.

***

### obstacleIntervalScale

> **obstacleIntervalScale**: `number`

Multiplies the gap between obstacle spawns (larger is easier).

***

### obstacleSpeedScale

> **obstacleSpeedScale**: `number`

Multiplies obstacle scroll speed.
