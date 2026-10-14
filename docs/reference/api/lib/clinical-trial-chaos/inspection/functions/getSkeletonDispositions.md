[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / getSkeletonDispositions

# Function: getSkeletonDispositions()

> **getSkeletonDispositions**(`round`, `skeletonCount`): [`SkeletonDisposition`](../../sponsor/type-aliases/SkeletonDisposition.md)[]

How each skeleton question was answered, by skeleton index. Skeletons the
round never reached count as unanswered.

## Parameters

### round

[`InspectionRound`](../interfaces/InspectionRound.md)

The round.

### skeletonCount

`number`

Skeletons taken during the run.

## Returns

[`SkeletonDisposition`](../../sponsor/type-aliases/SkeletonDisposition.md)[]

One disposition per skeleton.
