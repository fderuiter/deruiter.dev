[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/deal](../README.md) / OpenerDealing

# Type Alias: OpenerDealing

> **OpenerDealing** = `"POOL"` \| `"FIXED"`

How a run deals its first Blind's scripted setup (#2413). POOL is the
default: the run's seed picks one of the Blind's openers. FIXED always
deals the Blind's own `pinned` setup, as runs did before #2413, so a save
recorded then still replays move for move.
