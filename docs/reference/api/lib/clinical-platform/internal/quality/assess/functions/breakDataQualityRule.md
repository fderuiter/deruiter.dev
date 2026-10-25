[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/assess](../README.md) / breakDataQualityRule

# Function: breakDataQualityRule()

> **breakDataQualityRule**(`warehouse`, `ruleId`): [`Warehouse`](../../../../types/interfaces/Warehouse.md)

A copy of a warehouse with the smallest edit that breaks one platform
rule, for showing the rule catch a real defect.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

### ruleId

`string`

## Returns

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

## Throws

Error for an unknown rule id, or a conformance rule, whose
  defects are the pipeline's to inject.
