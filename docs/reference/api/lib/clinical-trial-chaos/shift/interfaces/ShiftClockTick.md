[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / ShiftClockTick

# Interface: ShiftClockTick

The advanced clocks plus what happened during the frame.

## Extends

- [`ShiftClocks`](ShiftClocks.md)

## Properties

### amendment

> **amendment**: [`ProtocolAmendment`](../../types/interfaces/ProtocolAmendment.md) \| `null`

#### Inherited from

[`ShiftClocks`](ShiftClocks.md).[`amendment`](ShiftClocks.md#amendment)

***

### amendmentSecondChanged

> **amendmentSecondChanged**: `boolean`

The running amendment's displayed whole second changed.

***

### auditor

> **auditor**: [`AuditorState`](../../types/interfaces/AuditorState.md)

#### Inherited from

[`ShiftClocks`](ShiftClocks.md).[`auditor`](ShiftClocks.md#auditor)

***

### coffeeBreakEnded

> **coffeeBreakEnded**: `boolean`

The FDA Coffee Break lifeline ran out this frame.

***

### concludedAmendment

> **concludedAmendment**: [`ProtocolAmendment`](../../types/interfaces/ProtocolAmendment.md) \| `null`

The amendment that concluded this frame, if any.

***

### expired

> **expired**: [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

Subjects that ran out of time this frame, removed from `subjects`.

***

### powerUps

> **powerUps**: [`PowerUpInventory`](../../types/type-aliases/PowerUpInventory.md)

#### Inherited from

[`ShiftClocks`](ShiftClocks.md).[`powerUps`](ShiftClocks.md#powerups)

***

### scoreState

> **scoreState**: [`GameScoreState`](../../types/interfaces/GameScoreState.md)

#### Inherited from

[`ShiftClocks`](ShiftClocks.md).[`scoreState`](ShiftClocks.md#scorestate)

***

### subjects

> **subjects**: [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

#### Inherited from

[`ShiftClocks`](ShiftClocks.md).[`subjects`](ShiftClocks.md#subjects)

***

### suspicionMaxed

> **suspicionMaxed**: `boolean`

Auditor suspicion reached 100 after the patrol step.
