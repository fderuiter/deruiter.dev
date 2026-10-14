[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / getSubmissionMode

# Function: getSubmissionMode()

> **getSubmissionMode**(`subject`, `targetStation`, `stations`, `context`): `"quick"` \| `"full"`

Chooses the in-game submission flow for a station route. Routine packets
can dispatch directly; safety cases, phase locks, active amendments, and
invalid destinations keep the full review dialog.

## Parameters

### subject

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

### targetStation

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

### stations

readonly `Pick`\<[`StationConfig`](../../types/interfaces/StationConfig.md), `"id"`\>[]

### context

#### amendmentActive

`boolean`

#### gameMode

[`GameMode`](../../types/type-aliases/GameMode.md)

#### phaseTarget

`number`

#### signaturesRequired?

`number`

Signature steps the CRF needs; two forces the review dialog (#2053).

#### submittedCount

`number`

## Returns

`"quick"` \| `"full"`
