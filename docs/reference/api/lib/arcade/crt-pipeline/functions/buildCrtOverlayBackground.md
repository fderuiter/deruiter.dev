[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / buildCrtOverlayBackground

# Function: buildCrtOverlayBackground()

> **buildCrtOverlayBackground**(`config`): `string`

Builds the CSS `background-image` for a static CRT overlay from a
calibration: a radial vignette, the scanline raster and, for a phosphor
mask, faint RGB columns. Returns an empty string when nothing would show.

## Parameters

### config

[`CRTCalibrationConfig`](../interfaces/CRTCalibrationConfig.md) \| `null`

CRT calibration, usually from [crtCalibrationForFilter](crtCalibrationForFilter.md).

## Returns

`string`

A comma-separated list of CSS gradients.
