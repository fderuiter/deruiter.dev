[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/working-with-duck-engine](../README.md) / WorkingWithDuckState

# Interface: WorkingWithDuckState

## Properties

### activeAccessory

> **activeAccessory**: [`DuckAccessory`](../type-aliases/DuckAccessory.md)

***

### activeCodeBursts

> **activeCodeBursts**: `number`

***

### activeHazardTarget

> **activeHazardTarget**: [`PortfolioHazardType`](../type-aliases/PortfolioHazardType.md) \| `null`

***

### activeSkillToast

> **activeSkillToast**: \{ `badge`: `string`; `text`: `string`; `timer`: `number`; \} \| `null`

***

### activeSurpriseEvent

> **activeSurpriseEvent**: \{ `maxTimer`: `number`; `resolved`: `boolean`; `timer`: `number`; `type`: `"amazon-delivery"` \| `"squirrel-window"` \| `"puppy-hiccups"`; \} \| `null`

***

### activeTrick

> **activeTrick**: \{ `maxTimer`: `number`; `timer`: `number`; `trick`: [`DuckTrick`](../type-aliases/DuckTrick.md); \} \| `null`

***

### ball

> **ball**: \{ `active`: `boolean`; `vx`: `number`; `vy`: `number`; `x`: `number`; `y`: `number`; \} \| `null`

***

### bathtubState

> **bathtubState**: [`BathtubState`](BathtubState.md)

***

### bellyRubProgress

> **bellyRubProgress**: `number`

***

### bellyRubScrubCount

> **bellyRubScrubCount**: `number`

***

### bladder

> **bladder**: `number`

***

### calmBuffTimer

> **calmBuffTimer**: `number`

***

### comboStreak

> **comboStreak**: `number`

***

### comboTimer

> **comboTimer**: `number`

***

### currentLevel

> **currentLevel**: `number`

***

### duck

> **duck**: `object`

#### angle

> **angle**: `number`

#### circleAngle

> **circleAngle**: `number`

#### isCarryingBall

> **isCarryingBall**: `boolean`

#### maxStateTimer

> **maxStateTimer**: `number`

#### sniffCountdown

> **sniffCountdown**: `number`

#### state

> **state**: [`DuckBehaviorState`](../type-aliases/DuckBehaviorState.md)

#### stateTimer

> **stateTimer**: `number`

#### tailWagAngle

> **tailWagAngle**: `number`

#### tailWagSpeed

> **tailWagSpeed**: `number`

#### targetX

> **targetX**: `number`

#### targetY

> **targetY**: `number`

#### vx

> **vx**: `number`

#### vy

> **vy**: `number`

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### excitement

> **excitement**: `number`

***

### floatingAlerts

> **floatingAlerts**: [`FloatingAlert`](FloatingAlert.md)[]

***

### hazards

> **hazards**: [`PortfolioHazard`](PortfolioHazard.md)[]

***

### highScore

> **highScore**: `number`

***

### hunger

> **hunger**: `number`

***

### inBathtub

> **inBathtub**: `boolean`

***

### inDogPark

> **inDogPark**: `boolean`

***

### indoorPuddles

> **indoorPuddles**: [`IndoorPuddle`](IndoorPuddle.md)[]

***

### isMuddy

> **isMuddy**: `boolean`

***

### lastCodeTick

> **lastCodeTick**: `number`

***

### lastImpulseTick

> **lastImpulseTick**: `number`

***

### latestUnlockedFact

> **latestUnlockedFact**: [`DuckFact`](DuckFact.md) \| `null`

***

### mode

> **mode**: `"campaign"` \| `"endless"`

***

### multiplier

> **multiplier**: `number`

***

### naughtyVsGood

> **naughtyVsGood**: `number`

***

### nextAlertId

> **nextAlertId**: `number`

***

### nextParticleId

> **nextParticleId**: `number`

***

### nextPuddleId

> **nextPuddleId**: `number`

***

### officeStations

> **officeStations**: [`OfficeStations`](OfficeStations.md)

***

### parkReadyAtTick?

> `optional` **parkReadyAtTick?**: `number`

Sprint tick from which the Dog Park can be opened again (#1942).

***

### parkState

> **parkState**: `object`

#### ballVx

> **ballVx**: `number`

#### ballVy

> **ballVy**: `number`

#### ballX

> **ballX**: `number`

#### ballY

> **ballY**: `number`

#### bones

> **bones**: [`ParkBone`](ParkBone.md)[]

#### bonesCollected

> **bonesCollected**: `number`

#### duckAngle

> **duckAngle**: `number`

#### duckIsJumping

> **duckIsJumping**: `boolean`

#### duckVx

> **duckVx**: `number`

#### duckVy

> **duckVy**: `number`

#### duckX

> **duckX**: `number`

#### duckY

> **duckY**: `number`

#### friends

> **friends**: [`ParkFriend`](ParkFriend.md)[]

#### hurdles

> **hurdles**: [`ParkHurdle`](ParkHurdle.md)[]

#### hurdlesCleared

> **hurdlesCleared**: `number`

#### jumpHeight

> **jumpHeight**: `number`

#### mode

> **mode**: `"ball"` \| `"frisbee"`

#### puddles

> **puddles**: [`MudPuddle`](MudPuddle.md)[]

#### status

> **status**: `"success"` \| `"aim"` \| `"thrown"` \| `"retrieving"` \| `"muddy"`

#### timer

> **timer**: `number`

#### whistleTaps

> **whistleTaps**: `number`

***

### particles

> **particles**: [`Particle`](Particle.md)[]

***

### selectedItem

> **selectedItem**: [`InventoryItem`](../type-aliases/InventoryItem.md)

***

### soundCueQueue

> **soundCueQueue**: [`SoundCue`](../type-aliases/SoundCue.md)[]

***

### status

> **status**: `"idle"` \| `"running"` \| `"failed"` \| `"paused"` \| `"won"`

***

### targetWorkProgress

> **targetWorkProgress**: `number`

***

### thirst

> **thirst**: `number`

***

### ticks

> **ticks**: `number`

***

### totalScore

> **totalScore**: `number`

***

### tutorialStep

> **tutorialStep**: `number`

***

### unlockedAccessories

> **unlockedAccessories**: [`DuckAccessory`](../type-aliases/DuckAccessory.md)[]

***

### unlockedFacts

> **unlockedFacts**: `number`[]

***

### workProgress

> **workProgress**: `number`
