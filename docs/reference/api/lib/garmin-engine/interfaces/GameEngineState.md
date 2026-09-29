[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / GameEngineState

# Interface: GameEngineState

## Properties

### allocatedFlashKb

> **allocatedFlashKb**: `number`

***

### allocatedRamKb

> **allocatedRamKb**: `number`

***

### battery

> **battery**: `number`

***

### consecutiveDodges

> **consecutiveDodges**: `number`

***

### crashReport

> **crashReport**: [`CrashReport`](CrashReport.md) \| `null`

***

### device

> **device**: [`DeviceTarget`](../type-aliases/DeviceTarget.md)

***

### distanceMeters

> **distanceMeters**: `number`

Unrounded distance; round only when displaying.

***

### flashFiles?

> `optional` **flashFiles?**: [`FlashVariable`](FlashVariable.md)[]

***

### flashVariables

> **flashVariables**: [`FlashVariable`](FlashVariable.md)[]

***

### fogLevel

> **fogLevel**: `number`

***

### fogWipes

> **fogWipes**: [`FogPoint`](FogPoint.md)[]

***

### gameState

> **gameState**: `"idle"` \| `"playing"` \| `"paused"` \| `"crashed"` \| `"shutdown"` \| `"summary"`

***

### gcTimerMs

> **gcTimerMs**: `number`

***

### heartRate

> **heartRate**: `number`

***

### highScore

> **highScore**: `number`

***

### isGcActive

> **isGcActive**: `boolean`

***

### isGrounded

> **isGrounded**: `boolean`

***

### isLightOn

> **isLightOn**: `boolean`

***

### lastAllocTime

> **lastAllocTime**: `number`

***

### lastObstacleTime

> **lastObstacleTime**: `number`

***

### lightActiveDurationMs

> **lightActiveDurationMs**: `number`

***

### obstacles

> **obstacles**: [`Obstacle`](Obstacle.md)[]

***

### playerVy

> **playerVy**: `number`

***

### playerY

> **playerY**: `number`

***

### score

> **score**: `number`

***

### scoreRemainder?

> `optional` **scoreRemainder?**: `number`

Fractional score (0 to under 1) carried between ticks.

***

### thermalStress

> **thermalStress**: `number`

***

### tuning?

> `optional` **tuning?**: [`GarminRunTuning`](GarminRunTuning.md)

Setup-derived parameters for this run; absent means defaults.

***

### variables

> **variables**: [`MemoryVariable`](MemoryVariable.md)[]
