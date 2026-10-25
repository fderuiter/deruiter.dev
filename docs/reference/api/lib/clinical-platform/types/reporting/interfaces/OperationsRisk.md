[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / OperationsRisk

# Interface: OperationsRisk

Risk-based quality management for the study drilled into (#2631),
narrowed to the country or site in scope. QTLs are study-level, so they
are never narrowed.

## Properties

### csm

> `readonly` **csm**: [`OperationsCsm`](OperationsCsm.md)

***

### factors

> `readonly` **factors**: readonly [`OperationsRiskFactor`](OperationsRiskFactor.md)[]

***

### kris

> `readonly` **kris**: readonly [`OperationsKri`](OperationsKri.md)[]

***

### log

> `readonly` **log**: readonly [`RiskSignalLogEntry`](../../rbqm/interfaces/RiskSignalLogEntry.md)[]

The risk signal log at the data cut: every study-level signal, and the
site signals raised at a site in scope.

***

### planEffectiveOn

> `readonly` **planEffectiveOn**: `string`

***

### planVersion

> `readonly` **planVersion**: `string`

Quality plan version, and the ISO 8601 date it took effect.

***

### qtls

> `readonly` **qtls**: readonly [`OperationsQtl`](OperationsQtl.md)[]

***

### sites

> `readonly` **sites**: readonly [`OperationsRiskSite`](OperationsRiskSite.md)[]

Activated sites in scope, in id order, each with the scope that drills into it.

***

### studyId

> `readonly` **studyId**: `string`
