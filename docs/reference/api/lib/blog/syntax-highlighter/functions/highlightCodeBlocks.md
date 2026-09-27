[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/blog/syntax-highlighter](../README.md) / highlightCodeBlocks

# Function: highlightCodeBlocks()

> **highlightCodeBlocks**(`html`): `string`

Injects syntax-highlighted spans into preformatted code blocks within sanitized HTML.
Unsupported languages and unannotated blocks remain safely unmodified.

## Parameters

### html

`string`

Sanitized article HTML containing pre and code blocks.

## Returns

`string`

HTML with tokenized code blocks.
