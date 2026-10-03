[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/debt](../README.md) / fabricatedBits

# Function: fabricatedBits()

> **fabricatedBits**(`candidates`, `claimed`): `number`

Fabricated precision D_fab = log2(|S| / |S_P|) for a claim narrowing a
finite candidate set S to S_P without evidence. Zero when nothing is
narrowed; throws when the claim is empty or larger than the evidence set.

## Parameters

### candidates

`number`

### claimed

`number`

## Returns

`number`
