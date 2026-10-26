[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioFinance

# Interface: PortfolioFinance

Budget against forecast at completion, across the portfolio (#2912).

## Properties

### actualSpendText

> `readonly` **actualSpendText**: `string`

Actual spend to the data cut, formatted.

***

### budgetAtCompletionText

> `readonly` **budgetAtCompletionText**: `string`

Budget at completion of every study, formatted.

***

### forecastAtCompletionText

> `readonly` **forecastAtCompletionText**: `string`

Forecast at completion of every study, formatted.

***

### reports

> `readonly` **reports**: readonly [`ReportData`](../../platform/interfaces/ReportData.md)[]

The governed finance reports: budget, actual and forecast at completion
by study and by vendor, then the variance and cost per enrolled
subject by study, then the variance by vendor.

***

### shareText

> `readonly` **shareText**: `string`

Forecast as a share of budget at completion, formatted.

***

### studyOverruns

> `readonly` **studyOverruns**: readonly [`PortfolioOverrun`](PortfolioOverrun.md)[]

Studies forecast to overrun, largest overrun first.

***

### varianceAtCompletion

> `readonly` **varianceAtCompletion**: `number` \| `null`

Forecast minus budget at completion, US dollars; `null` with no budget.

***

### varianceAtCompletionText

> `readonly` **varianceAtCompletionText**: `string`

The variance, formatted.

***

### vendorOverruns

> `readonly` **vendorOverruns**: readonly [`PortfolioOverrun`](PortfolioOverrun.md)[]

Vendors forecast to overrun across their studies, largest first.
