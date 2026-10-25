[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/rbqm](../README.md) / CsmRun

# Interface: CsmRun

Central statistical monitoring of one study's sites.

## Properties

### excluded

> `readonly` **excluded**: readonly [`CsmExclusion`](CsmExclusion.md)[]

***

### fdr

> `readonly` **fdr**: `number`

False discovery rate the tests are controlled at.

***

### results

> `readonly` **results**: readonly [`CsmResult`](CsmResult.md)[]

***

### sites

> `readonly` **sites**: readonly `string`[]

Sites with enough data, in id order.
