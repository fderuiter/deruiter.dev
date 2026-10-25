[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / Portfolio

# Interface: Portfolio

One synthetic sponsor portfolio: studies, sites, vendors and bronze feeds.

## Properties

### asOf

> `readonly` **asOf**: `string`

ISO 8601 data cut: no record describes anything after this date.

***

### feeds

> `readonly` **feeds**: [`BronzeFeeds`](BronzeFeeds.md)

Bronze-layer operational feeds.

***

### id

> `readonly` **id**: `string`

Stable portfolio id.

***

### seed

> `readonly` **seed**: `number`

Seed the portfolio was generated from.

***

### signals

> `readonly` **signals**: readonly [`PortfolioSignal`](PortfolioSignal.md)[]

Patterns planted on purpose for analytics to find.

***

### sites

> `readonly` **sites**: readonly [`Site`](Site.md)[]

Sites across all studies.

***

### sponsor

> `readonly` **sponsor**: `string`

Fictional sponsor name.

***

### studies

> `readonly` **studies**: readonly [`Study`](Study.md)[]

Studies in the portfolio.

***

### studyDataRuns

> `readonly` **studyDataRuns**: readonly [`StudyDataRunReference`](StudyDataRunReference.md)[]

Study Data Pipeline runs that supplied study records, one per study.

***

### vendors

> `readonly` **vendors**: readonly [`Vendor`](Vendor.md)[]

Fictional vendors the studies use.
