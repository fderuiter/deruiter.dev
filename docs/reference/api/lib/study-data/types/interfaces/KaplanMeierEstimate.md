[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / KaplanMeierEstimate

# Interface: KaplanMeierEstimate

A Kaplan-Meier estimate with Greenwood standard errors.

## Properties

### censored

> `readonly` **censored**: `number`

Subjects censored.

***

### confidenceLevel

> `readonly` **confidenceLevel**: `number`

Confidence level of the limits, 0.95.

***

### confidenceTransform

> `readonly` **confidenceTransform**: `"log-log"`

Transform the limits are computed on.

***

### events

> `readonly` **events**: `number`

Subjects with an event.

***

### n

> `readonly` **n**: `number`

Subjects.

***

### steps

> `readonly` **steps**: readonly [`KaplanMeierStep`](KaplanMeierStep.md)[]

One step per distinct observed time, in ascending order.
