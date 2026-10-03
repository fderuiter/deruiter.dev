[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / crtCalibrationForFilter

# Function: crtCalibrationForFilter()

> **crtCalibrationForFilter**(`filter`): [`CRTCalibrationConfig`](../interfaces/CRTCalibrationConfig.md) \| `null`

Maps the wizard's CRT setting onto a calibration from this pipeline, so a
game that draws its CRT in canvas (via [renderCRTEffects](renderCRTEffects.md)) and the
cabinet's CSS overlay use the same numbers.

## Parameters

### filter

[`CabinetCrtFilter`](../type-aliases/CabinetCrtFilter.md)

The wizard's CRT setting.

## Returns

[`CRTCalibrationConfig`](../interfaces/CRTCalibrationConfig.md) \| `null`

A static calibration, or null for `off`.
