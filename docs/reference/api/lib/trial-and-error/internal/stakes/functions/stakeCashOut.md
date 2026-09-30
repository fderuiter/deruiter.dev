[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/stakes](../README.md) / stakeCashOut

# Function: stakeCashOut()

> **stakeCashOut**(`report`, `tier`, `modifiers`): [`CashOutReport`](../../shop/interfaces/CashOutReport.md)

A cash-out under a stake: at Sponsor Audit and above a Small Blind's
milestone payment is $0k, while unspent CPU and interest still pay.

## Parameters

### report

[`CashOutReport`](../../shop/interfaces/CashOutReport.md)

### tier

`"SMALL_BLIND"` \| `"BIG_BLIND"` \| `"BOSS_BLIND"`

### modifiers

[`StakeModifiers`](../interfaces/StakeModifiers.md)

## Returns

[`CashOutReport`](../../shop/interfaces/CashOutReport.md)
