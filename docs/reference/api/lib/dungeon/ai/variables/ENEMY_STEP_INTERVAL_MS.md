[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/ai](../README.md) / ENEMY\_STEP\_INTERVAL\_MS

# Variable: ENEMY\_STEP\_INTERVAL\_MS

> `const` **ENEMY\_STEP\_INTERVAL\_MS**: `333` = `333`

Real time between two enemy steps. Callers accumulate elapsed time and run
one AI step each time this much has passed, so enemies move at the same
speed on a 60 Hz and a 144 Hz display (#1665).
