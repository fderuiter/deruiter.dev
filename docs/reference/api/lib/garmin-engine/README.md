[**fderuiter-portfolio**](../../README.md)

***

[fderuiter-portfolio](../../modules.md) / lib/garmin-engine

# lib/garmin-engine

## Classes

- [GarminWatchEngine](classes/GarminWatchEngine.md)

## Interfaces

- [BonusRoom](interfaces/BonusRoom.md)
- [CrashReport](interfaces/CrashReport.md)
- [DeviceProfile](interfaces/DeviceProfile.md)
- [FaceBanner](interfaces/FaceBanner.md)
- [FacePopup](interfaces/FacePopup.md)
- [FlashVariable](interfaces/FlashVariable.md)
- [FogPoint](interfaces/FogPoint.md)
- [GameEngineState](interfaces/GameEngineState.md)
- [GarminRunTuning](interfaces/GarminRunTuning.md)
- [GarminWatchSnapshot](interfaces/GarminWatchSnapshot.md)
- [MemoryVariable](interfaces/MemoryVariable.md)
- [Obstacle](interfaces/Obstacle.md)

## Type Aliases

- [DeviceTarget](type-aliases/DeviceTarget.md)
- [GameRules](type-aliases/GameRules.md)
- [GarminDifficulty](type-aliases/GarminDifficulty.md)
- [GarminLoadout](type-aliases/GarminLoadout.md)
- [ObstacleType](type-aliases/ObstacleType.md)
- [VariableType](type-aliases/VariableType.md)

## Variables

- [CANVAS\_SIZE](variables/CANVAS_SIZE.md)
- [CIQ\_PALETTE](variables/CIQ_PALETTE.md)
- [COYOTE\_MS](variables/COYOTE_MS.md)
- [DEFAULT\_RUN\_TUNING](variables/DEFAULT_RUN_TUNING.md)
- [DEVICE\_PROFILES](variables/DEVICE_PROFILES.md)
- [DIFFICULTY\_RAMP\_METERS](variables/DIFFICULTY_RAMP_METERS.md)
- [FALL\_GRAVITY](variables/FALL_GRAVITY.md)
- [FLASH\_STORAGE\_KEY](variables/FLASH_STORAGE_KEY.md)
- [FLASH\_TOKEN\_SCORE](variables/FLASH_TOKEN_SCORE.md)
- [GC\_BATTERY\_COST](variables/GC_BATTERY_COST.md)
- [GC\_COOLDOWN\_MS](variables/GC_COOLDOWN_MS.md)
- [GC\_SCORE](variables/GC_SCORE.md)
- [GRAVITY](variables/GRAVITY.md)
- [GROUND\_Y](variables/GROUND_Y.md)
- [JETTISON\_COOLDOWN\_MS](variables/JETTISON_COOLDOWN_MS.md)
- [JETTISON\_SCORE](variables/JETTISON_SCORE.md)
- [JUMP\_BUFFER\_MS](variables/JUMP_BUFFER_MS.md)
- [JUMP\_CUT\_VY](variables/JUMP_CUT_VY.md)
- [JUMP\_FORCE](variables/JUMP_FORCE.md)
- [KUDOS\_SCORE](variables/KUDOS_SCORE.md)
- [MAX\_FALL\_VY](variables/MAX_FALL_VY.md)
- [MEM\_TOKEN\_SCORE](variables/MEM_TOKEN_SCORE.md)
- [PACE](variables/PACE.md)
- [PLAYER\_HEIGHT](variables/PLAYER_HEIGHT.md)
- [PLAYER\_WIDTH](variables/PLAYER_WIDTH.md)
- [PLAYER\_X](variables/PLAYER_X.md)
- [REQUIRED\_VARIABLE\_NAMES](variables/REQUIRED_VARIABLE_NAMES.md)
- [STAGE\_CLEAR\_SCORE](variables/STAGE_CLEAR_SCORE.md)
- [STOMP\_BOUNCE\_VY](variables/STOMP_BOUNCE_VY.md)
- [STOMP\_SCORE](variables/STOMP_SCORE.md)
- [SYNC\_BLOCK\_SCORE](variables/SYNC_BLOCK_SCORE.md)
- [VARIABLE\_RAM\_COSTS](variables/VARIABLE_RAM_COSTS.md)

## Functions

- [allocateFlashVariable](functions/allocateFlashVariable.md)
- [allocateVariable](functions/allocateVariable.md)
- [causeLabel](functions/causeLabel.md)
- [clearFlashStorage](functions/clearFlashStorage.md)
- [createInitialState](functions/createInitialState.md)
- [enterStation](functions/enterStation.md)
- [getCooldownRemainingMs](functions/getCooldownRemainingMs.md)
- [getDifficultyRamp](functions/getDifficultyRamp.md)
- [isCollectibleVariable](functions/isCollectibleVariable.md)
- [isFitnessRun](functions/isFitnessRun.md)
- [jettisonOldestVariable](functions/jettisonOldestVariable.md)
- [loadPersistedFlashStorage](functions/loadPersistedFlashStorage.md)
- [paceFor](functions/paceFor.md)
- [pauseGame](functions/pauseGame.md)
- [pressAction](functions/pressAction.md)
- [pressJump](functions/pressJump.md)
- [releaseJump](functions/releaseJump.md)
- [renderCanvasFrame](functions/renderCanvasFrame.md)
- [resolveRunTuning](functions/resolveRunTuning.md)
- [resumeGame](functions/resumeGame.md)
- [savePersistedFlashStorage](functions/savePersistedFlashStorage.md)
- [setRules](functions/setRules.md)
- [setRunInput](functions/setRunInput.md)
- [spinCape](functions/spinCape.md)
- [startGame](functions/startGame.md)
- [throwBolt](functions/throwBolt.md)
- [triggerGarbageCollection](functions/triggerGarbageCollection.md)
- [updateGameSimulation](functions/updateGameSimulation.md)
- [wipeScreenFog](functions/wipeScreenFog.md)
