[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / SyntheticRecord

# Interface: SyntheticRecord

Provenance every generated record carries. The platform holds synthetic
data only, and each record says so on its own, so a row copied out of a
table or a download keeps the label.

## Extended by

- [`BronzeRecord`](BronzeRecord.md)
- [`Site`](Site.md)
- [`Study`](Study.md)
- [`Vendor`](Vendor.md)
- [`PortfolioSignal`](PortfolioSignal.md)
- [`StudyDataRunReference`](StudyDataRunReference.md)

## Properties

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.
