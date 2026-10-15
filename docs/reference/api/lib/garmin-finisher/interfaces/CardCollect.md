[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-finisher](../README.md) / CardCollect

# Interface: CardCollect

The cards after collecting one, and what a completed set paid.

## Properties

### cards

> **cards**: [`FinisherCard`](../../garmin-engine/type-aliases/FinisherCard.md)[]

The cards held after this one: fewer than three.

***

### payout

> **payout**: [`CardPayout`](CardPayout.md) \| `null`

The completed set's payout, or null while the set is still filling.

***

### set

> **set**: [`FinisherCard`](../../garmin-engine/type-aliases/FinisherCard.md)[]

The completed set, empty while it is still filling.
