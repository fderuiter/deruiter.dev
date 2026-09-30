[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/types](../README.md) / GameScoreState

# Interface: GameScoreState

## Properties

### auditViolations

> **auditViolations**: `number`

Every missed or misrouted CRF: expired subjects plus station rejections.

***

### cleanSubmissions

> **cleanSubmissions**: `number`

***

### combo

> **combo**: `number`

***

### correctionsMade

> **correctionsMade**: `number`

***

### expiredSubjects

> **expiredSubjects**: `number`

Subjects that expired on the conveyor, a subset of `auditViolations` (#1670).

***

### highScore

> **highScore**: `number`

***

### maxCombo

> **maxCombo**: `number`

***

### multiplier

> **multiplier**: `number`

***

### phaseSubmissions

> **phaseSubmissions**: `number`

CRFs locked in the running phase, counted against its target (#1673).

***

### score

> **score**: `number`

***

### subjectsSubmitted

> **subjectsSubmitted**: `number`

CRFs locked across the whole campaign run.
