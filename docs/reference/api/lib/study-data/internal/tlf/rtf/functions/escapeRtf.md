[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/rtf](../README.md) / escapeRtf

# Function: escapeRtf()

> **escapeRtf**(`value`): `string`

Escapes text for an RTF 1.x body: backslash and braces are escaped,
characters outside printable ASCII become `\uN?` with N as a signed
16-bit value, and characters beyond the Basic Multilingual Plane become a
surrogate pair.

## Parameters

### value

`string`

## Returns

`string`
