[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / BronzeFeeds

# Interface: BronzeFeeds

The raw operational feeds of the bronze layer, grouped by source.

## Properties

### cec

> `readonly` **cec**: readonly [`CecAdjudication`](CecAdjudication.md)[]

Clinical events committee adjudications, for studies that have one.

***

### ctms

> `readonly` **ctms**: [`CtmsFeed`](CtmsFeed.md)

Clinical trial management system.

***

### edc

> `readonly` **edc**: [`EdcFeed`](EdcFeed.md)

Electronic data capture.

***

### etmf

> `readonly` **etmf**: readonly [`EtmfDocument`](EtmfDocument.md)[]

Electronic trial master file: expected documents.

***

### finance

> `readonly` **finance**: readonly [`FinanceLine`](FinanceLine.md)[]

Finance: budget against actual.

***

### financePlan

> `readonly` **financePlan**: readonly [`FinancePlanLine`](FinancePlanLine.md)[]

Finance: the approved budget plan, quarter by quarter to completion.

***

### irt

> `readonly` **irt**: [`IrtFeed`](IrtFeed.md)

Interactive response technology.
