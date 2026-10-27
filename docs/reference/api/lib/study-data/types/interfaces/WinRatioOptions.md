[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioOptions

# Interface: WinRatioOptions

Options for `winStatistics`.

## Properties

### alpha?

> `readonly` `optional` **alpha?**: `number`

Two-sided significance level of the limits, in (0, 1). Defaults to 0.05.

***

### components

> `readonly` **components**: readonly [`WinRatioComponent`](WinRatioComponent.md)[]

The components, most important first.

***

### sided?

> `readonly` `optional` **sided?**: `"two-sided"` \| `"one-sided"`

Sidedness of the p-values. Defaults to `"two-sided"`.

***

### weighting?

> `readonly` `optional` **weighting?**: [`WinRatioStratumWeighting`](../type-aliases/WinRatioStratumWeighting.md)

How strata are combined. Defaults to `"unstratified"`.
