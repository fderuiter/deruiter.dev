[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/props](../README.md) / wallAhead

# Function: wallAhead()

> **wallAhead**(`props`, `groundY`, `prevRight`, `nextRight`, `feetBottom`): `number` \| `null`

Solid sides: stations and plyo boxes block a runner whose feet are below
their top. Returns the smallest box left edge x such that feetBottom > top
+ 1 and prevRight <= x + 0.5 and nextRight > x; else null.

## Parameters

### props

[`CourseProps`](../interfaces/CourseProps.md)

### groundY

`number`

### prevRight

`number`

### nextRight

`number`

### feetBottom

`number`

## Returns

`number` \| `null`
