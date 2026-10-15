[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / SurvivalWave

# Interface: SurvivalWave

The shape of an Arcade Survival run at a moment in time.

## Properties

### fireLevel

> **fireLevel**: `number`

The act number fed to minion fire, or 0 while minions hold fire. Higher
levels fire more often (see `updateMinionFire`).

***

### label

> **label**: `"Lake"` \| `"Fair"` \| `"Hearing"` \| `"Capitol"`

The wave's short name for the HUD.

***

### maxTargets

> **maxTargets**: `number`

Most enemies on screen at once.

***

### rosterAct

> **rosterAct**: `number`

The campaign act whose enemy roster this wave fields, 1 to 4.

***

### spawnChance

> **spawnChance**: `number`

Chance per 60 fps frame of spawning an enemy.

***

### wave

> **wave**: `number`

Zero-based wave index.
