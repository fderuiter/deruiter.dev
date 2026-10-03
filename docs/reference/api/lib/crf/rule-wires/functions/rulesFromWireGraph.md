[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/rule-wires](../README.md) / rulesFromWireGraph

# Function: rulesFromWireGraph()

> **rulesFromWireGraph**(`graph`): [`EditCheckRule`](../../types/interfaces/EditCheckRule.md)[]

Rebuild the rules a wire graph was projected from. Projecting rules and
rebuilding them returns rules deep-equal to the originals, which is the
sentence-to-wires-to-sentence equivalence the wire editor depends on.

## Parameters

### graph

[`RuleWireGraph`](../interfaces/RuleWireGraph.md)

## Returns

[`EditCheckRule`](../../types/interfaces/EditCheckRule.md)[]
