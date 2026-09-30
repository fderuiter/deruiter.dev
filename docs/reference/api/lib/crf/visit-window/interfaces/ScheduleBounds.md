[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / ScheduleBounds

# Interface: ScheduleBounds

## Properties

### contractionBufferDays

> **contractionBufferDays**: `number`

Total potential contraction buffer (sum of all windowBefore days across visits)

***

### expansionBufferDays

> **expansionBufferDays**: `number`

Total potential expansion buffer (sum of all windowAfter days across visits)

***

### maxContractionDays

> **maxContractionDays**: `number`

Minimum possible study duration including last visit early window and first visit late window

***

### maxExpansionDays

> **maxExpansionDays**: `number`

Maximum possible study duration including last visit late window and first visit early window

***

### targetDurationDays

> **targetDurationDays**: `number`

Target duration from first visit target day to last visit target day
