[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioSubjectResult

# Interface: WinRatioSubjectResult

Wins, losses and ties per subject: the row or column sums of the pairs.

## Properties

### group

> `readonly` **group**: `"treatment"` \| `"control"`

The subject's group.

***

### id

> `readonly` **id**: `string`

The subject's identifier.

***

### losses

> `readonly` **losses**: `number`

Pairs in which this subject was the worse member.

***

### ties

> `readonly` **ties**: `number`

Pairs tied on every component.

***

### wins

> `readonly` **wins**: `number`

Pairs in which this subject was the better member.
