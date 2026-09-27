[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/blog/syntax-highlighter](../README.md) / getCodeTokenClass

# Function: getCodeTokenClass()

> **getCodeTokenClass**(`token`, `language`): `"string"` \| `"number"` \| `"literal"` \| `"comment"` \| `"keyword"` \| `"operator"` \| `null`

Determines the syntax token classification for a matched token in a given language.

## Parameters

### token

`string`

The matched token substring.

### language

`string`

The canonical code language identifier.

## Returns

`"string"` \| `"number"` \| `"literal"` \| `"comment"` \| `"keyword"` \| `"operator"` \| `null`

The token class name suffix or null if untokenized.
