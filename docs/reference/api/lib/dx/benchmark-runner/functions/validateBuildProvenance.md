[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/benchmark-runner](../README.md) / validateBuildProvenance

# Function: validateBuildProvenance()

> **validateBuildProvenance**(`provenance`, `context`): `object`

Decides whether an earlier `npm run build` can stand in for the build a
production assertion would run itself (#1769). It must be a completed
`npm run build` of the exact current revision, from a tree that was clean
before and after the build, whose BUILD_ID is the one on disk, and recent.

## Parameters

### provenance

`unknown`

### context

[`BuildProvenanceValidationContext`](../interfaces/BuildProvenanceValidationContext.md)

## Returns

`object`

### errors

> **errors**: `string`[]

### valid

> **valid**: `boolean`
