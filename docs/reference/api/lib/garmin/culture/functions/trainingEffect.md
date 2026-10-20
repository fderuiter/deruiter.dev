[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/culture](../README.md) / trainingEffect

# Function: trainingEffect()

> **trainingEffect**(`effort`): `number`

Training Effect for a cleared stage, 0.0..5.0 rounded to one decimal: base 2.0, +0.4 per foe defeated (max +1.6), +0.8 for no hits taken, +0.6 for a top-step pole grab (poleHeight >= 0.9), -0.5 per life lost (min 0).

## Parameters

### effort

[`StageEffort`](../interfaces/StageEffort.md)

## Returns

`number`
