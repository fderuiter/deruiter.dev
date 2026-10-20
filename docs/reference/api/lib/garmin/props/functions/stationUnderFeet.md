[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/props](../README.md) / stationUnderFeet

# Function: stationUnderFeet()

> **stationUnderFeet**(`props`, `footLeft`, `footRight`, `feetBottom`, `groundY`): [`CourseStation`](../interfaces/CourseStation.md) \| `null`

The enterable, unused station the runner stands on: feet overlap [x, x+width]
and |feetBottom - (groundY - height)| <= 1. Else null.

## Parameters

### props

[`CourseProps`](../interfaces/CourseProps.md)

### footLeft

`number`

### footRight

`number`

### feetBottom

`number`

### groundY

`number`

## Returns

[`CourseStation`](../interfaces/CourseStation.md) \| `null`
