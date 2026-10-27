[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioComponent

# Interface: WinRatioComponent

One component of a hierarchical composite endpoint, compared between
the two members of a pair only when every component above it is a tie.

## Properties

### better

> `readonly` **better**: `"lower"` \| `"higher"`

Which values are better. For a time to an event, `"higher"` means a
later event is better (death, hospitalisation) and `"lower"` means an
earlier event is better (time to recovery). For a binary outcome,
`"higher"` means 1 is better than 0.

***

### horizon?

> `readonly` `optional` **horizon?**: `number`

For a time to an event: the end of the comparison window. Later times
are censored at it. Defaults to no limit.

***

### id

> `readonly` **id**: `string`

Identifier, unique within the hierarchy (for example a PARAMCD).

***

### kind

> `readonly` **kind**: [`WinRatioComponentKind`](../type-aliases/WinRatioComponentKind.md)

How the outcome is recorded and compared.

***

### label

> `readonly` **label**: `string`

Label for tables.

***

### margin?

> `readonly` `optional` **margin?**: `number`

The smallest difference that counts as a win, in the outcome's unit,
finite and not negative. A difference equal to the margin is a tie.
Ignored for binary outcomes. Defaults to 0.
