[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/plan](../README.md) / WorkoutResult

# Interface: WorkoutResult

What a cleared workout carries back to the plan.

## Properties

### cards?

> `optional` **cards?**: readonly [`FinisherCard`](../../engine/type-aliases/FinisherCard.md)[]

The Finisher Cards held at the finish (#1996). Unset for a run that
collects none, Race Day's, which leaves the plan's cards as they are.

***

### lives

> **lives**: `number`

Lives left at the finish.

***

### score

> **score**: `number`

Points scored in the workout.

***

### trainingEffect

> **trainingEffect**: `number` \| `null`

The stage's Training Effect, if graded.
