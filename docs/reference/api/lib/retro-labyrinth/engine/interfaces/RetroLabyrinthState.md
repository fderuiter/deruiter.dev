[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/retro-labyrinth/engine](../README.md) / RetroLabyrinthState

# Interface: RetroLabyrinthState

## Properties

### activeWeaponId

> **activeWeaponId**: `string`

***

### campaignRooms

> **campaignRooms**: [`DungeonRoom`](../../../dungeon/types/interfaces/DungeonRoom.md)[]

***

### crtThemeId

> **crtThemeId**: [`CRTThemeId`](../../../dungeon/types/type-aliases/CRTThemeId.md)

***

### cryptoCredits

> **cryptoCredits**: `number`

***

### currentMaze

> **currentMaze**: `string`[][]

***

### enemies

> **enemies**: [`Enemy`](../../../dungeon/types/interfaces/Enemy.md)[]

***

### exploredCells

> **exploredCells**: `boolean`[][]

***

### faceForgeBoss

> **faceForgeBoss**: [`BossState`](../../../dungeon/types/interfaces/BossState.md) \| `null`

***

### floatingTexts

> **floatingTexts**: [`FloatingNotification`](../../../dungeon/types/interfaces/FloatingNotification.md)[]

***

### gameMode

> **gameMode**: `"custom"` \| `"classic"` \| `"roguelike"`

***

### gameStatus

> **gameStatus**: `"playing"` \| `"victory"` \| `"game_over"`

***

### hexPuzzle

> **hexPuzzle**: `unknown`

***

### highScore

> **highScore**: `number`

***

### items

> **items**: [`ItemPickup`](../../../dungeon/types/interfaces/ItemPickup.md)[]

***

### maxHp

> **maxHp**: `number`

***

### particles

> **particles**: [`ParticleEffect`](../../../dungeon/types/interfaces/ParticleEffect.md)[]

***

### playerHp

> **playerHp**: `number`

***

### playerPosition

> **playerPosition**: `object`

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### roomIndex

> **roomIndex**: `number`

***

### score

> **score**: `number`

***

### selectedClassId

> **selectedClassId**: [`CyberdeckClassId`](../../../dungeon/types/type-aliases/CyberdeckClassId.md)

***

### selectedWeaponIndex

> **selectedWeaponIndex**: `number`

***

### sideEffects

> **sideEffects**: [`ActiveSideEffect`](../../../dungeon/types/interfaces/ActiveSideEffect.md)[]

***

### stage

> **stage**: `number`

***

### tspTour

> **tspTour**: `number`[]

***

### visibleCells

> **visibleCells**: `boolean`[][]

***

### visitedNodes

> **visitedNodes**: `number`[]

***

### weapons

> **weapons**: [`Weapon`](../../../dungeon/types/interfaces/Weapon.md)[]
