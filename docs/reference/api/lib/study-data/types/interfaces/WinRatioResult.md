[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioResult

# Interface: WinRatioResult

The result of `winStatistics`.

## Properties

### components

> `readonly` **components**: readonly [`WinRatioComponentResult`](WinRatioComponentResult.md)[]

Per component, in the hierarchy's order.

***

### controlCount

> `readonly` **controlCount**: `number`

Control subjects.

***

### finkelsteinSchoenfeld

> `readonly` **finkelsteinSchoenfeld**: [`FinkelsteinSchoenfeldTest`](FinkelsteinSchoenfeldTest.md)

The Finkelstein-Schoenfeld test.

***

### losses

> `readonly` **losses**: `number`

Pairs won by the control member.

***

### netBenefit

> `readonly` **netBenefit**: [`WinStatisticEstimate`](WinStatisticEstimate.md)

Wins less losses, over pairs (the win difference).

***

### pairs

> `readonly` **pairs**: `number`

Treatment-control pairs compared, within strata.

***

### settings

> `readonly` **settings**: `object`

The settings the result was computed with.

#### alpha

> `readonly` **alpha**: `number`

#### sided

> `readonly` **sided**: `"two-sided"` \| `"one-sided"`

#### weighting

> `readonly` **weighting**: [`WinRatioStratumWeighting`](../type-aliases/WinRatioStratumWeighting.md)

***

### strata

> `readonly` **strata**: readonly [`WinRatioStratumResult`](WinRatioStratumResult.md)[]

Per stratum, in order of first appearance.

***

### subjects

> `readonly` **subjects**: readonly [`WinRatioSubjectResult`](WinRatioSubjectResult.md)[]

Per subject, in input order.

***

### ties

> `readonly` **ties**: `number`

Pairs tied on every component.

***

### treatmentCount

> `readonly` **treatmentCount**: `number`

Treatment subjects.

***

### winOdds

> `readonly` **winOdds**: [`WinStatisticEstimate`](WinStatisticEstimate.md)

Wins plus half the ties, over losses plus half the ties.

***

### winRatio

> `readonly` **winRatio**: [`WinStatisticEstimate`](WinStatisticEstimate.md)

Wins over losses.

***

### wins

> `readonly` **wins**: `number`

Pairs won by the treatment member.
