[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinRatioComponentResult

# Interface: WinRatioComponentResult

Wins and losses decided on one component.

## Properties

### componentId

> `readonly` **componentId**: `string`

The component's identifier.

***

### decidingSubjectIds

> `readonly` **decidingSubjectIds**: readonly `string`[]

Subjects with at least one pair decided on this component, in input order.

***

### losses

> `readonly` **losses**: `number`

Pairs the control member won on this component.

***

### tiesAfter

> `readonly` **tiesAfter**: `number`

Pairs still tied after this component.

***

### wins

> `readonly` **wins**: `number`

Pairs the treatment member won on this component.
