[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / ScorecardInput

# Interface: ScorecardInput

Facts the scorecard needs about how the run went.

## Properties

### applicabilityErrors

> **applicabilityErrors**: `number`

***

### chipCount

> **chipCount**: `number`

Chips in the pipeline revision that was live at lock.

***

### fabricatedBits

> **fabricatedBits**: `number`

Fabricated precision introduced over the whole run, in bits, counting
records that were later corrected and superseded (#2054).

***

### integrityPassed

> **integrityPassed**: `boolean`

***

### lateBacklogRoutedV1

> **lateBacklogRoutedV1**: `boolean`

***

### lockedAtMinute

> **lockedAtMinute**: `number`

***

### queries

> **queries**: [`ClinicalQuery`](ClinicalQuery.md)[]

***

### regexSplitBeforeNarrative

> **regexSplitBeforeNarrative**: `boolean`

***

### rejectedCommands

> **rejectedCommands**: `number`

Commands the engine turned down during the run (#2054).

***

### sites

> **sites**: `Record`\<[`SiteId`](../type-aliases/SiteId.md), [`SiteState`](SiteState.md)\>

***

### sleuthResolvedWithEvidence

> **sleuthResolvedWithEvidence**: `boolean`

***

### wireCount

> **wireCount**: `number`

Wires in the pipeline revision that was live at lock.
