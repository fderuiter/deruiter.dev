[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / PackageLock

# Interface: PackageLock

A locked CSR package (#922): the immutable audit summary of the release,
and the table as it stood before the lock, which a protocol amendment
reopens.

## Properties

### amendment

> **amendment**: `number`

Protocol amendments filed before this lock.

***

### before

> **before**: [`TableState`](TableState.md)

The table just before the lock hand was played.

***

### campaign

> **campaign**: [`CampaignRecord`](../../package/interfaces/CampaignRecord.md)[]

Every Blind the campaign cleared, this one last.

***

### final

> **final**: [`CampaignScore`](../../package/interfaces/CampaignScore.md)

***

### handScore

> **handScore**: `number`

The lock hand's score.

***

### outputs

> **outputs**: [`LockedOutput`](LockedOutput.md)[]

***

### packageName

> **packageName**: `string`

***

### roundScore

> **roundScore**: `number`

The Blind's round score with the lock hand.
