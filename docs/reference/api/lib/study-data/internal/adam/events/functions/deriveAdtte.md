[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/adam/events](../README.md) / deriveAdtte

# Function: deriveAdtte()

> **deriveAdtte**(`definition`, `sdtm`, `adsl`, `adae`, `adcm`): `object`

Derive the time-to-event parameters for each dosed subject: TTADISC for
the Kaplan-Meier figure, and TTDTH, TTSAE and TTRESC for the
hierarchical composite.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

### sdtm

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

### adsl

[`Dataset`](../../../../types/interfaces/Dataset.md)

### adae

[`Dataset`](../../../../types/interfaces/Dataset.md)

### adcm

[`Dataset`](../../../../types/interfaces/Dataset.md)

## Returns

`object`

### dataset

> `readonly` **dataset**: [`Dataset`](../../../../types/interfaces/Dataset.md)

### findings

> `readonly` **findings**: readonly [`Finding`](../../../../types/interfaces/Finding.md)[]
