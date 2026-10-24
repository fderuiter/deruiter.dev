[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/km](../README.md) / kaplanMeierEstimate

# Function: kaplanMeierEstimate()

> **kaplanMeierEstimate**(`observations`): [`KaplanMeierEstimate`](../../../../types/interfaces/KaplanMeierEstimate.md)

The Kaplan-Meier (product-limit) estimate of the survival function.

There is one step for every distinct time at which an event or a
censoring was observed, in ascending order. Ties follow the standard
product-limit convention: every subject whose time is t, event or
censored, is at risk at t; the d events at t make one factor of
`1 - d / n`; censorings at t leave the risk set after that factor.

The standard error is Greenwood's, `S(t) * sqrt(Σ d / (n (n - d)))` over
event times up to t. When the estimate reaches 0 the sum is undefined and
the standard error is reported as 0, as Minitab and SAS print it. The
95% limits use the log-log transform and are `null` (not estimable) where
S is 1 or 0.

## Parameters

### observations

readonly [`SurvivalObservation`](../../../../types/interfaces/SurvivalObservation.md)[]

One time and event flag per subject. Times are in
  any unit, finite and not negative.

## Returns

[`KaplanMeierEstimate`](../../../../types/interfaces/KaplanMeierEstimate.md)

The estimate. With no observations it has no steps.

## Throws

RangeError when a time is negative or not finite, or an event
  flag is missing.
