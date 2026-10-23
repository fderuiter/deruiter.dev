[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / stageSnapStep

# Function: stageSnapStep()

> **stageSnapStep**(`aspect`): `number`

The smallest whole CSS width whose height at this aspect is also whole: 5
for a 240x144 (5:3) game. A whole-unit aspect with a step above 32px, or a
fractional one, snaps to 1px instead, and its height keeps the exact ratio.

## Parameters

### aspect

[`StageAspect`](../interfaces/StageAspect.md)

The game's logical size.

## Returns

`number`

The width step, in CSS pixels.
