[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / CABINET\_CRT\_PROFILES

# Variable: CABINET\_CRT\_PROFILES

> `const` **CABINET\_CRT\_PROFILES**: `Readonly`\<`Record`\<`string`, [`CabinetCrtProfile`](../interfaces/CabinetCrtProfile.md)\>\>

Per-game CRT profile, keyed by the cabinet's `gameId`. Retro Labyrinth
renders the calibrated pipeline above inside its canvas, and Monkey C
Mayhem paints its own `.garmin-crt` overlay from the wizard setting; the
cabinet layer stands down for both until they hand it over.
