[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Receipt

# Interface: Receipt

The ending: a story artifact that explains itself. It is not a grade.

## Properties

### assist

> `readonly` **assist**: `string` \| `null`

The honest line about the solo helper, present only when it was on.

***

### challenges

> `readonly` **challenges**: readonly [`ChallengeResult`](ChallengeResult.md)[]

Game challenges: game play only, never a judgment of the wedding.

***

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

### gameWeather

> `readonly` **gameWeather**: `string` \| `null`

Game weather, labelled as game weather; null on a standard day.

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

### stars

> `readonly` **stars**: `number`

How many of the challenges the run met, from 0 to 3.

***

### suit

> `readonly` **suit**: `string`

***

### title

> `readonly` **title**: [`RunTitle`](../type-aliases/RunTitle.md)

***

### weather

> `readonly` **weather**: `string`

The real weather line, kept as Fred and Abbi told it.

***

### website

> `readonly` **website**: readonly [`WebsiteLine`](WebsiteLine.md)[]
