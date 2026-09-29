[**fderuiter-portfolio**](../../README.md)

***

[fderuiter-portfolio](../../modules.md) / lib/garmin-engine

# lib/garmin-engine

## Classes

- [GarminWatchEngine](classes/GarminWatchEngine.md)

## Interfaces

- [CrashReport](interfaces/CrashReport.md)
- [DeviceProfile](interfaces/DeviceProfile.md)
- [FlashVariable](interfaces/FlashVariable.md)
- [FogPoint](interfaces/FogPoint.md)
- [GameEngineState](interfaces/GameEngineState.md)
- [GarminRunTuning](interfaces/GarminRunTuning.md)
- [GarminWatchSnapshot](interfaces/GarminWatchSnapshot.md)
- [MemoryVariable](interfaces/MemoryVariable.md)
- [Obstacle](interfaces/Obstacle.md)

## Type Aliases

- [DeviceTarget](type-aliases/DeviceTarget.md)
- [GarminDifficulty](type-aliases/GarminDifficulty.md)
- [GarminLoadout](type-aliases/GarminLoadout.md)
- [ObstacleType](type-aliases/ObstacleType.md)
- [VariableType](type-aliases/VariableType.md)

## Variables

- [CANVAS\_SIZE](variables/CANVAS_SIZE.md)
- [CIQ\_PALETTE](variables/CIQ_PALETTE.md)
- [DEFAULT\_RUN\_TUNING](variables/DEFAULT_RUN_TUNING.md)
- [DEVICE\_PROFILES](variables/DEVICE_PROFILES.md)
- [DIFFICULTY\_RAMP\_METERS](variables/DIFFICULTY_RAMP_METERS.md)
- [FLASH\_STORAGE\_KEY](variables/FLASH_STORAGE_KEY.md)
- [FLASH\_TOKEN\_SCORE](variables/FLASH_TOKEN_SCORE.md)
- [GC\_BATTERY\_COST](variables/GC_BATTERY_COST.md)
- [GC\_COOLDOWN\_MS](variables/GC_COOLDOWN_MS.md)
- [GC\_SCORE](variables/GC_SCORE.md)
- [GRAVITY](variables/GRAVITY.md)
- [GROUND\_Y](variables/GROUND_Y.md)
- [JETTISON\_COOLDOWN\_MS](variables/JETTISON_COOLDOWN_MS.md)
- [JETTISON\_SCORE](variables/JETTISON_SCORE.md)
- [JUMP\_FORCE](variables/JUMP_FORCE.md)
- [MEM\_TOKEN\_SCORE](variables/MEM_TOKEN_SCORE.md)
- [PLAYER\_HEIGHT](variables/PLAYER_HEIGHT.md)
- [PLAYER\_WIDTH](variables/PLAYER_WIDTH.md)
- [PLAYER\_X](variables/PLAYER_X.md)
- [REQUIRED\_VARIABLE\_NAMES](variables/REQUIRED_VARIABLE_NAMES.md)
- [VARIABLE\_RAM\_COSTS](variables/VARIABLE_RAM_COSTS.md)

## Functions

- [allocateFlashVariable](functions/allocateFlashVariable.md)
- [allocateVariable](functions/allocateVariable.md)
- [clearFlashStorage](functions/clearFlashStorage.md)
- [createInitialState](functions/createInitialState.md)
- [getCooldownRemainingMs](functions/getCooldownRemainingMs.md)
- [getDifficultyRamp](functions/getDifficultyRamp.md)
- [isCollectibleVariable](functions/isCollectibleVariable.md)
- [jettisonOldestVariable](functions/jettisonOldestVariable.md)
- [loadPersistedFlashStorage](functions/loadPersistedFlashStorage.md)
- [pauseGame](functions/pauseGame.md)
- [renderCanvasFrame](functions/renderCanvasFrame.md)
- [resolveRunTuning](functions/resolveRunTuning.md)
- [resumeGame](functions/resumeGame.md)
- [savePersistedFlashStorage](functions/savePersistedFlashStorage.md)
- [startGame](functions/startGame.md)
- [triggerGarbageCollection](functions/triggerGarbageCollection.md)
- [updateGameSimulation](functions/updateGameSimulation.md)
- [wipeScreenFog](functions/wipeScreenFog.md)
