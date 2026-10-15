[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / getSurvivalWave

# Function: getSurvivalWave()

> **getSurvivalWave**(`elapsedSeconds`): [`SurvivalWave`](../interfaces/SurvivalWave.md)

Arcade Survival's ramp: every wave fields the next act's roster (Lake, Fair,
Hearing, Capitol, then round again), spawns come faster and in larger
crowds until full heat, and from the second wave on the minions shoot back,
more often each wave.

## Parameters

### elapsedSeconds

`number`

Seconds of unpaused survival so far.

## Returns

[`SurvivalWave`](../interfaces/SurvivalWave.md)
