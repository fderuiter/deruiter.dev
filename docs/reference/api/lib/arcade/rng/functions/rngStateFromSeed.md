[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/rng](../README.md) / rngStateFromSeed

# Function: rngStateFromSeed()

> **rngStateFromSeed**(`seed`): `number`

The stream's starting state for a seed. A number is floored and wrapped to
32 bits (a non-finite number counts as 0); a string is hashed.

## Parameters

### seed

[`RngSeed`](../type-aliases/RngSeed.md)

The seed.

## Returns

`number`

The starting state.
