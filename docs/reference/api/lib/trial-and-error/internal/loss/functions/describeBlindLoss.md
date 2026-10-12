[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/loss](../README.md) / describeBlindLoss

# Function: describeBlindLoss()

> **describeBlindLoss**(`view`): `string` \| `null`

Why a Blind was lost, in one or two sentences read from the table view
(#1944): how far short the round fell, the best hand played, and what ran
out. Null unless the Blind failed, and null for a Clinical Hold, whose
own notice already says why.

## Parameters

### view

[`TableView`](../../table/interfaces/TableView.md)

## Returns

`string` \| `null`
