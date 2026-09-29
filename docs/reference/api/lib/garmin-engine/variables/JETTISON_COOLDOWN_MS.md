[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / JETTISON\_COOLDOWN\_MS

# Variable: JETTISON\_COOLDOWN\_MS

> `const` **JETTISON\_COOLDOWN\_MS**: `1500` = `1500`

Memory actions cost something, so managing the heap is a choice rather than
free points (#1320): a pop needs a short recharge, and a GC needs a longer
one and draws battery on top of its freeze and heat.
