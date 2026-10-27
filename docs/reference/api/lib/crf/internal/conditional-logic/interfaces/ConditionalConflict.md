[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / ConditionalConflict

# Interface: ConditionalConflict

A rule that fired but did not get its way, recorded so an author can see
that two rules disagreed rather than silently losing one of them.

## Properties

### fieldId

> **fieldId**: `string`

***

### overridden

> **overridden**: [`RuleAttribution`](RuleAttribution.md)[]

Attributions that fired for the same field but were overridden.

***

### reason

> **reason**: `string`

***

### winner

> **winner**: [`RuleAttribution`](RuleAttribution.md)

The attribution that took effect.
