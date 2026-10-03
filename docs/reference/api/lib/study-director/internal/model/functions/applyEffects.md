[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/model](../README.md) / applyEffects

# Function: applyEffects()

> **applyEffects**(`state`, `effects`): [`StudyState`](../../../types/interfaces/StudyState.md)

Applies a set of effects to the study without recording a decision. The
world layer uses it for work that lands over time (#1689): an assignment
a team member clears night by night, or a meeting's cost to the team.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### effects

[`Effects`](../../../types/interfaces/Effects.md)

## Returns

[`StudyState`](../../../types/interfaces/StudyState.md)
