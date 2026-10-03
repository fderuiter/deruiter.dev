[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/presets](../README.md) / GOLDEN\_ADVS

# Variable: GOLDEN\_ADVS

> `const` **GOLDEN\_ADVS**: readonly [`GoldenAdvsRow`](../type-aliases/GoldenAdvsRow.md)[]

The 20 evaluable ADVS rows exactly as #1095 tabulates them (values at
display precision). Rows for C01 and C02 Day 28 systolic were rounded
before subtraction in the issue (20.2 and 15.7); the engine derives from
unrounded values (decision 10), which display as 20.3 and 15.8, so the
golden check allows one display step (0.1).
