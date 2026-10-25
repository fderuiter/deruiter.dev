[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / OperationsCsm

# Interface: OperationsCsm

Central statistical monitoring of the sites in scope.

## Properties

### excluded

> `readonly` **excluded**: readonly [`CsmExclusion`](../../rbqm/interfaces/CsmExclusion.md)[]

What could not be tested in scope, and why.

***

### fdr

> `readonly` **fdr**: `number`

False discovery rate the tests are controlled at, across the whole study.

***

### results

> `readonly` **results**: readonly [`CsmResult`](../../rbqm/interfaces/CsmResult.md)[]

Every result at those sites, by site then test.

***

### sites

> `readonly` **sites**: readonly `string`[]

Sites in scope with enough data to test, in id order.

***

### tests

> `readonly` **tests**: readonly [`CsmTestDefinition`](../../rbqm/interfaces/CsmTestDefinition.md)[]
