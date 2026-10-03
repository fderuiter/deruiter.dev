[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / ScenarioDependencySnapshot

# Interface: ScenarioDependencySnapshot

Fingerprints of every study object a scenario's outcome depended on when it
ran (#679), keyed `kind:id/aspect` (for example `field:bmi/formula`).

## Properties

### fingerprints

> **fingerprints**: `Record`\<`string`, `string`\>

***

### version

> **version**: `number`

Version of the fingerprint material; a mismatch makes evidence unverifiable rather than current.
