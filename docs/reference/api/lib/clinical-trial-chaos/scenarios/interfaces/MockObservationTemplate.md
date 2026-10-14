[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/scenarios](../README.md) / MockObservationTemplate

# Interface: MockObservationTemplate

## Properties

### corruptions

> **corruptions**: `object`[]

Authored puzzles. A field with a procedural generator (#2088) may leave
this empty; its flagged observations are then always generated.

#### correctedValue

> **correctedValue**: `string`

#### ctCode?

> `optional` **ctCode?**: `string`

#### errorType

> **errorType**: [`ValidationErrorType`](../../types/type-aliases/ValidationErrorType.md)

#### explanation

> **explanation**: `string`

#### hint

> **hint**: `string`

#### options

> **options**: `string`[]

#### rawValue

> **rawValue**: `string`

***

### destination

> **destination**: [`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

***

### field

> **field**: `string`

***

### testCode

> **testCode**: `string`

***

### validValues

> **validValues**: `string`[]
