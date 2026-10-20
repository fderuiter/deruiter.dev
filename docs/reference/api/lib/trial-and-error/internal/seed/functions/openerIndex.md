[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / openerIndex

# Function: openerIndex()

> **openerIndex**(`seed`, `size`): `number`

Which of a first Blind's `size` openers a run on `seed` opens on (#2413),
from 0. The pick is a pure function of the seed, on a stream of its own,
so a seed replays the same opener every time and no other draw moves. Only
a codec seed picks: the Daily Protocol's, a random run's or one typed in
or opened from a challenge link. A named seed from before the codec opens
on the Blind's own setup, opener 0, as it always did, so old links still
deal what they dealt.

## Parameters

### seed

`string`

### size

`number`

## Returns

`number`
