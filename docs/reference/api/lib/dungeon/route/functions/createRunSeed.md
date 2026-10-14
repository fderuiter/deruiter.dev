[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / createRunSeed

# Function: createRunSeed()

> **createRunSeed**(`entropy?`): `string`

A new run seed, such as "LAB-3F9K2Q". The seed only names the run; the
route and rewards are drawn from it with the seeded PRNG.

## Parameters

### entropy?

`number`

A 32-bit number to build the seed from. Left out, the
  browser's crypto source is used, or the clock where there is none.

## Returns

`string`

The seed.
