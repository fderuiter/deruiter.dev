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

### banner?

> `optional` **banner?**: [`FaceBanner`](FaceBanner.md) \| `null`

***

### battery

> **battery**: `number`

***

### boltCooldownMs?

> `optional` **boltCooldownMs?**: `number`

Milliseconds until the next bolt can be thrown.

***

### bolts?

> `optional` **bolts?**: [`Bolt`](../../garmin-powerups/interfaces/Bolt.md)[]

Heat bolts on the face.

***

### boltsThrown?

> `optional` **boltsThrown?**: `number`

Bolts thrown this run, for their ids.

***

### consecutiveDodges

> **consecutiveDodges**: `number`

***

### course?

> `optional` **course?**: [`CourseLayout`](../../garmin-course/interfaces/CourseLayout.md)

Live course features: gaps, ledges, blocks, Kudos and finish poles.

***

### courseSeed?

> `optional` **courseSeed?**: `number`

Seed the run's stages are laid out from.

***

### coyoteMs?

> `optional` **coyoteMs?**: `number`

Milliseconds since the runner last had footing, for coyote time.

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

### flightMs?

> `optional` **flightMs?**: `number`

Milliseconds left in which a Cape runner's jump presses climb.

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

### invulnerableMs?

> `optional` **invulnerableMs?**: `number`

Milliseconds of hit immunity left after a hit or a lost life.

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

### jumpBufferMs?

> `optional` **jumpBufferMs?**: `number`

Milliseconds a jump pressed in the air is still remembered.

***

### jumpHeld?

> `optional` **jumpHeld?**: `boolean`

The jump key is held: the rise uses the lighter gravity.

***

### kudos?

> `optional` **kudos?**: `number`

Kudos collected this run.

***

### lastAllocTime

> **lastAllocTime**: `number`

***

### lastGcAt?

> `optional` **lastGcAt?**: `number`

Wall-clock time of the last GC, for its cooldown.

***

### lastJettisonAt?

> `optional` **lastJettisonAt?**: `number`

Wall-clock time of the last pop, for its cooldown.

***

### lastObstacleTime

> **lastObstacleTime**: `number`

***

### lightActiveDurationMs

> **lightActiveDurationMs**: `number`

***

### lives?

> `optional` **lives?**: `number`

Lives left, counting the current one; absent means this is the last.

***

### obstacles

> **obstacles**: [`Obstacle`](Obstacle.md)[]

***

### paceMeter?

> `optional` **paceMeter?**: `number`

Pace meter, 0 (empty) to 1 (full).

***

### pausedAt?

> `optional` **pausedAt?**: `number`

Wall-clock time the run was paused, so resuming can shift the spawn timers.

***

### pickups?

> `optional` **pickups?**: [`Pickup`](../../garmin-powerups/interfaces/Pickup.md)[]

Power-ups travelling the course.

***

### playerVy

> **playerVy**: `number`

***

### playerY

> **playerY**: `number`

***

### popups?

> `optional` **popups?**: [`FacePopup`](FacePopup.md)[]

***

### power?

> `optional` **power?**: [`PowerTier`](../../garmin-powerups/type-aliases/PowerTier.md)

Power tier; absent means Base.

***

### runInput?

> `optional` **runInput?**: `0` \| `1` \| `-1`

Held pace input: 1 sprints, -1 brakes, 0 runs.

***

### score

> **score**: `number`

***

### scoreRemainder?

> `optional` **scoreRemainder?**: `number`

Fractional score (0 to under 1) carried between ticks.

***

### spinCooldownMs?

> `optional` **spinCooldownMs?**: `number`

Milliseconds until the next spin can start.

***

### spinMs?

> `optional` **spinMs?**: `number`

Milliseconds left in the current cape spin.

***

### stage?

> `optional` **stage?**: `number`

Current stage, 1 to [STAGE\_COUNT](../../garmin-course/variables/STAGE_COUNT.md).

***

### starMs?

> `optional` **starMs?**: `number`

Milliseconds of Runner's High (invincibility) left.

***

### stompChain?

> `optional` **stompChain?**: `number`

Stomps since the runner last touched footing; each doubles the points.

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
