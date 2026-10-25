[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/generate](../README.md) / generatePortfolio

# Function: generatePortfolio()

> **generatePortfolio**(`options`): [`Portfolio`](../../../../types/platform/interfaces/Portfolio.md)

Generates the synthetic sponsor portfolio and its bronze operational
feeds: eight studies (drug Phase I to III, two device IDE studies, three
run by fictional CROs), about 120 sites in 12 countries, and EDC, CTMS,
IRT, eTMF, finance, protocol deviation and CEC adjudication records.

DEMO-301 is the Study Data Pipeline's study. Its protocol is the USDM
definition the pipeline reads, and its subjects, randomisations and visits
are the collected data of `runPipeline` from `@/lib/study-data`, run with
the same seed. `studyDataRuns` records how to reproduce that run.

The output is a pure function of the seed: the same seed gives a
byte-identical result, with no clock, locale or network input. Every
record carries `synthetic: true`, and no record describes anything after
the data cut in `asOf`. Planted patterns are listed in `signals`.

## Parameters

### options

[`PortfolioOptions`](../../../../types/portfolio/interfaces/PortfolioOptions.md)

Generation options; `seed` is an integer from 0 to 4294967295.

## Returns

[`Portfolio`](../../../../types/platform/interfaces/Portfolio.md)

The portfolio.

## Throws

RangeError when the seed is not an integer in range.
