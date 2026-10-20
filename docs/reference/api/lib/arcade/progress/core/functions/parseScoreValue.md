[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/core](../README.md) / parseScoreValue

# Function: parseScoreValue()

> **parseScoreValue**(`raw`): `number`

Parses a raw storage value into a clean number.

## Parameters

### raw

`string` \| `number` \| `null` \| `undefined`

A stored score: a bare number, a JSON envelope, a Quasi
  Puzzler save or a Meme Vault trophy list.

## Returns

`number`

The score, or 0 when there is none.
