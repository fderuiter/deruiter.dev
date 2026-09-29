[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/og-image](../README.md) / getOgFonts

# Function: getOgFonts()

> **getOgFonts**(): `OgFont`[]

Brand font buffers for Satori (Lexend body, Geist Mono telemetry), read
once per server process and kept in memory. If the files cannot be read the
card falls back to the system sans-serif rather than failing the request,
and the next call tries again.

## Returns

`OgFont`[]
