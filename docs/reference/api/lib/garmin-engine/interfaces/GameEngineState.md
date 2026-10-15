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

### bestAtStart?

> `optional` **bestAtStart?**: `number`

Best score when the run began, so a new PR is announced once.

***

### bestSplits?

> `optional` **bestSplits?**: `number`[]

Best split per lap on this device when the run began, for the lap banner's colour.

***

### bodyBattery?

> `optional` **bodyBattery?**: [`BodyBattery`](../../garmin-body-battery/interfaces/BodyBattery.md)

Body Battery under the fitness rules.

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

### bonkedMs?

> `optional` **bonkedMs?**: `number`

Time spent bonked in this race, in ms (#2019).

***

### bonusRoom?

> `optional` **bonusRoom?**: [`BonusRoom`](BonusRoom.md) \| `null`

Set while the runner is in a Water Station's bonus room.

***

### carrying?

> `optional` **carrying?**: `boolean`

The runner is carrying a medicine ball.

***

### carryingId?

> `optional` **carryingId?**: `number`

Id of the carried medicine ball, reused when it is thrown and lands.

***

### checkpoint?

> `optional` **checkpoint?**: [`CourseCheckpoint`](../../garmin-course/interfaces/CourseCheckpoint.md) \| `null`

The Aid Station touched on the current stage; reset by startGame, cleared on a stage clear, kept across lost lives (#2025).

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

### finisherCards?

> `optional` **finisherCards?**: [`FinisherCard`](../type-aliases/FinisherCard.md)[] \| `null`

The Finisher Cards held this run (#1996), or unset when the run collects
none. The engine carries them untouched; lib/garmin-finisher.ts acts on
them.

***

### finisherNews?

> `optional` **finisherNews?**: `string` \| `null`

What the last card collected said, for the screen reader (#1996).

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

### foes?

> `optional` **foes?**: [`Foe`](../../garmin-foes/interfaces/Foe.md)[]

Foes placed on the course for the current stage.

***

### foeShots?

> `optional` **foeShots?**: [`FoeShot`](../../garmin-foes/interfaces/FoeShot.md)[]

Shots fired by Auto Laps and the Rep Max.

***

### foeShotsFired?

> `optional` **foeShotsFired?**: `number`

Foe shots fired this run, for their ids.

***

### fogLevel

> **fogLevel**: `number`

***

### fogWipes

> **fogWipes**: [`FogPoint`](FogPoint.md)[]

***

### furthestMeters?

> `optional` **furthestMeters?**: `number`

Furthest distance reached this run, in metres. A lost life rewinds
`distanceMeters` to the stage start, so pace is measured on this.

***

### gameState

> **gameState**: `"idle"` \| `"playing"` \| `"paused"` \| `"crashed"` \| `"shutdown"` \| `"summary"`

***

### gcTimerMs

> **gcTimerMs**: `number`

***

### gearTaken?

> `optional` **gearTaken?**: `boolean`

A power-up, gear or the training buddy was taken in this race (#2019).

***

### gpsMs?

> `optional` **gpsMs?**: `number`

Milliseconds left of the "Waiting for GPS…" intro; the run holds until it ends.

***

### heartRate

> **heartRate**: `number`

***

### highScore

> **highScore**: `number`

***

### idleMs?

> `optional` **idleMs?**: `number`

Milliseconds the runner has been easing or standing on footing, for the move alert.

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

### kudosMissed?

> `optional` **kudosMissed?**: `number`

Free lane Kudos that went by uncollected in this race (#2019).

***

### lapSplits?

> `optional` **lapSplits?**: `number`[]

Lap splits so far, one per cleared stage, in ms.

***

### lapStartMs?

> `optional` **lapStartMs?**: `number`

Run clock reading when the current lap began.

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

### lastTrainingEffect?

> `optional` **lastTrainingEffect?**: `number`

Training Effect of the last cleared stage.

***

### lightActiveDurationMs

> **lightActiveDurationMs**: `number`

***

### lives?

> `optional` **lives?**: `number`

Lives left, counting the current one; absent means this is the last.

***

### loadout?

> `optional` **loadout?**: [`Loadout`](Loadout.md) \| `null`

Gear packed from the Training Plan's bag that is still to take effect
(#1995). The engine carries it untouched; lib/garmin-bag.ts acts on it.

***

### medalsFound?

> `optional` **medalsFound?**: `number`[]

Finisher Medal ids found this run; reset by startGame, kept across lost lives and stages (#2025).

***

### medBallToasted?

> `optional` **medBallToasted?**: `boolean`

The "Med ball!" toast has shown this run.

***

### movesUsed?

> `optional` **movesUsed?**: [`MoveName`](../../garmin-moves/type-aliases/MoveName.md)[]

Moves already toasted this run, so each toast shows once per run.

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

### pendingRules?

> `optional` **pendingRules?**: [`GameRules`](../type-aliases/GameRules.md)

Rules chosen during a run, applied when the next run starts.

***

### pickups?

> `optional` **pickups?**: [`Pickup`](../../garmin-powerups/interfaces/Pickup.md)[]

Power-ups travelling the course.

***

### plan?

> `optional` **plan?**: [`PlanRun`](../../garmin-plan/interfaces/PlanRun.md) \| `null`

The Training Plan workout being run (#1994): the one stage it plays, and
whether it is Race Day. Null or absent for any other run.

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

### prAnnounced?

> `optional` **prAnnounced?**: `boolean`

A new PR was announced this run.

***

### propClockMs?

> `optional` **propClockMs?**: `number`

Milliseconds of play this run, which drives the Treadmill Belts.

***

### props?

> `optional` **props?**: [`CourseProps`](../../garmin-props/interfaces/CourseProps.md)

Water Stations, Plyo Boxes, Treadmill Belts and Rest Day Switches.

***

### race?

> `optional` **race?**: [`RaceSetup`](../../garmin-race/interfaces/RaceSetup.md) \| `null`

The race being run (#2019): its course seed and category. Null or absent for a Training Run.

***

### restDayMs?

> `optional` **restDayMs?**: `number`

Milliseconds left of a Rest Day, when bricks and Kudos swap.

***

### riding?

> `optional` **riding?**: `boolean`

The runner is riding a Running Buddy.

***

### rules?

> `optional` **rules?**: [`GameRules`](../type-aliases/GameRules.md)

Which rules the run plays by. "fitness" is the default game: no heap,
GC, flash, fog or watch battery, with Body Battery instead. "dev" is
the original firmware challenge (Dev Mode). Absent means "dev", so
snapshots from before #2010 keep the rules they were recorded under.

***

### runClockMs?

> `optional` **runClockMs?**: `number`

Game time of the run in ms: the sum of simulation steps while playing,
after the GPS lock. Pauses and the end of the run stop it.

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

### secondWind?

> `optional` **secondWind?**: [`SecondWind`](../../garmin-second-wind/interfaces/SecondWind.md) \| `null`

The Second Wind event running, if any (#2026). Started by a wind Sync
Block, ended by its timer, a lost life or a stage clear; null otherwise.

***

### secretExits?

> `optional` **secretExits?**: `number`[]

Stages whose secret exit was taken this run; reset by startGame, otherwise kept (#2025).

***

### simMs?

> `optional` **simMs?**: `number`

Race game time in ms: advances on every playing tick, GPS lock included, and stops while paused (#2019).

***

### slamming?

> `optional` **slamming?**: `boolean`

A Burpee Slam is falling: true from the press until the landing.

***

### spinCooldownMs?

> `optional` **spinCooldownMs?**: `number`

Milliseconds until the next spin can start.

***

### spinJump?

> `optional` **spinJump?**: `boolean`

A Spin Jump is in the air: true from the mid-air spin until the landing.

***

### spinMs?

> `optional` **spinMs?**: `number`

Milliseconds left in the current cape spin.

***

### stage?

> `optional` **stage?**: `number`

Current stage, 1 to [STAGE\_COUNT](../../garmin-course/variables/STAGE_COUNT.md).

***

### stageFoes?

> `optional` **stageFoes?**: `number`

Foes and bugs defeated this stage, for its Training Effect.

***

### stageHits?

> `optional` **stageHits?**: `number`

Hits taken this stage, for its Training Effect.

***

### stageLivesLost?

> `optional` **stageLivesLost?**: `number`

Lives lost this stage, for its Training Effect.

***

### starMs?

> `optional` **starMs?**: `number`

Milliseconds of Runner's High (invincibility) left.

***

### stompChain?

> `optional` **stompChain?**: `number`

Stomps since the runner last touched footing; each doubles the points.

***

### strokeCooldownMs?

> `optional` **strokeCooldownMs?**: `number`

Milliseconds until the next swimming stroke can start. A jump press
while swimming strokes only when this is zero; it counts down with the
game clock and resets on a new run and on a lost life.

***

### thermalStress

> **thermalStress**: `number`

***

### thrownBall?

> `optional` **thrownBall?**: [`ThrownBall`](../../garmin-medball/interfaces/ThrownBall.md) \| `null`

The medicine ball in flight, if any.

***

### tuning?

> `optional` **tuning?**: [`GarminRunTuning`](GarminRunTuning.md)

Setup-derived parameters for this run; absent means defaults.

***

### variables

> **variables**: [`MemoryVariable`](MemoryVariable.md)[]

***

### wallDown?

> `optional` **wallDown?**: `boolean`

Race Day's boss, The Wall, is beaten this run (#1994).

***

### wallJumpReady?

> `optional` **wallJumpReady?**: `boolean`

The current wall contact still has its Wall Jump. True on first contact
with a wall; a wall jump uses it up, and it is armed again only after the
runner leaves that wall or lands.

***

### wallSide?

> `optional` **wallSide?**: `boolean`

The runner is airborne and pressed against the side of a station or plyo box.
