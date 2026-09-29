[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / REQUIRED\_VARIABLE\_NAMES

# Variable: REQUIRED\_VARIABLE\_NAMES

> `const` **REQUIRED\_VARIABLE\_NAMES**: readonly `string`[]

Names of required app state allocated at boot. These are never collectible:
jettison and garbage collection skip them, so the watch stays functional.
