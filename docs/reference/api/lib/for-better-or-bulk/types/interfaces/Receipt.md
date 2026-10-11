[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Receipt

# Interface: Receipt

The ending: a story artifact that explains itself. It is not a grade.

## Properties

### disclaimer

> `readonly` **disclaimer**: `string`

***

### finishedAt

> `readonly` **finishedAt**: `string` \| `null`

***

### followThrough

> `readonly` **followThrough**: `object`

#### explanation

> `readonly` **explanation**: `string`

#### status

> `readonly` **status**: `"kept"` \| `"missed"`

***

### kitchen

> `readonly` **kitchen**: `string` \| `null`

***

### leftovers

> `readonly` **leftovers**: `string`

***

### readiness

> `readonly` **readiness**: readonly [`ReadinessLine`](ReadinessLine.md)[]

***

### signatureMoment

> `readonly` **signatureMoment**: `string`

***

### spending

> `readonly` **spending**: `object`

#### budget

> `readonly` **budget**: `number`

#### lines

> `readonly` **lines**: readonly [`SpendingLine`](SpendingLine.md)[]

#### total

> `readonly` **total**: `number`

***

### suit

> `readonly` **suit**: `string`

***

### title

> `readonly` **title**: [`RunTitle`](../type-aliases/RunTitle.md)

***

### weather

> `readonly` **weather**: `string`

***

### website

> `readonly` **website**: readonly [`WebsiteLine`](WebsiteLine.md)[]
