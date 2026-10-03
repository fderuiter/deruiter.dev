[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / PersonState

# Interface: PersonState

The world layer of one team member, derived from the study and their bond.

## Properties

### confidence

> **confidence**: `number`

0 to 100.

***

### energy

> **energy**: `number`

0 to 100. Long days and a heavy load drain it.

***

### memberId

> **memberId**: `string`

***

### mood

> **mood**: [`Mood`](../type-aliases/Mood.md)

***

### name

> **name**: `string`

***

### owns

> **owns**: `"queries"` \| `"analysis"` \| `"programming"` \| `"monitoring"` \| `"training"` \| `"writing"` \| `null`

The stream they own, if any.

***

### role

> **role**: [`TeamRole`](../../../study-director/types/type-aliases/TeamRole.md)

***

### stress

> **stress**: `number`

0 to 100.

***

### task

> **task**: `string`

What they are working on, in a few words.

***

### trust

> **trust**: `number`

0 to 100.

***

### workload

> **workload**: `number`

The domain's workload, 0 to 100.
