[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / restateBIMOSummary

# Function: restateBIMOSummary()

> **restateBIMOSummary**(`summary`, `from`, `to`): `string`

Restates a report summary after a later pass (the closing interview,
sponsor skeletons) changed its verdict, so the text never says "no
objectionable conditions" under a VAI or OAI verdict (#2172). Sentences
appended after the verdict summary are kept.

## Parameters

### summary

`string`

The current summary.

### from

`"NAI (No Action Indicated)"` \| `"VAI (Voluntary Action Indicated)"` \| `"OAI (Official Action Indicated - Form 483 Issued)"`

The verdict the summary was written for.

### to

`"NAI (No Action Indicated)"` \| `"VAI (Voluntary Action Indicated)"` \| `"OAI (Official Action Indicated - Form 483 Issued)"`

The new verdict.

## Returns

`string`

The summary for `to`.
