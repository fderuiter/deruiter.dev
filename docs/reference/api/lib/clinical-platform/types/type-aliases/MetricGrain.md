[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricGrain

# Type Alias: MetricGrain

> **MetricGrain** = `"portfolio"` \| `"study"`

Level a metric's value is defined at. A `portfolio` metric aggregates every
row in scope, so it rolls up to one portfolio value and can be grouped by
any of its allowed dimensions. A `study` metric is computed once per study
and has no value above the study, so every query of it groups by `study`.
