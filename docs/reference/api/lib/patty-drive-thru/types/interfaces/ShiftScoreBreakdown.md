[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftScoreBreakdown

# Interface: ShiftScoreBreakdown

The parts of a shift's arcade score (#2057), each already in points: late
cars are negative, and the closing and Dignity parts are zero unless the
shift reached close. `total` is their sum, never below zero.

## Properties

### closing

> `readonly` **closing**: `number`

***

### dignity

> `readonly` **dignity**: `number`

***

### late

> `readonly` **late**: `number`

***

### served

> `readonly` **served**: `number`

***

### speed

> `readonly` **speed**: `number`

***

### streak

> `readonly` **streak**: `number`

***

### total

> `readonly` **total**: `number`
