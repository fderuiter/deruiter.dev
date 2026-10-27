[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/layers](../README.md) / conformanceLayers

# Function: conformanceLayers()

> **conformanceLayers**(`recorded`): [`RuleLayer`](../interfaces/RuleLayer.md)[]

Every rule family the site runs, or deliberately does not, in layer order.

## Parameters

### recorded

[`RecordedFindings`](../../recorded/interfaces/RecordedFindings.md)

CDISC CORE's committed findings.

## Returns

[`RuleLayer`](../interfaces/RuleLayer.md)[]

The layers, from file structure up to the site's own rules.
