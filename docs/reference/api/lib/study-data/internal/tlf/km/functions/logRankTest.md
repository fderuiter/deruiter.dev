[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/km](../README.md) / logRankTest

# Function: logRankTest()

> **logRankTest**(`groups`): [`LogRankTest`](../../../../types/interfaces/LogRankTest.md)

The unstratified log-rank test that two or more survival distributions
are equal.

At each distinct event time, pooled over groups, each group contributes
its observed events and its expected events `n_j d / n`; the covariance
of observed minus expected uses the hypergeometric variance
`d (n - d) / (n - 1) * n_j / n * (δ_jl - n_l / n)`. The statistic is
`U'V⁻U` with U the observed minus expected totals and V⁻ a generalised
inverse of their covariance. Its degrees of freedom are the rank of V,
which is the number of groups less one when every group has information.

## Parameters

### groups

readonly (readonly [`SurvivalObservation`](../../../../types/interfaces/SurvivalObservation.md)[])[]

Observations for each group, in display order. A group
  may be empty.

## Returns

[`LogRankTest`](../../../../types/interfaces/LogRankTest.md)

Per-group totals and the test. `chiSquare` and `pValue` are
  `null` (not estimable) when there are no events or fewer than two
  groups with information.

## Throws

RangeError when a time is negative or not finite, or an event
  flag is missing.
