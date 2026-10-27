[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardStatus

# Type Alias: StandardStatus

> **StandardStatus** = `"current"` \| `"upgrade-available"` \| `"held"`

How the pinned version stands against the newest published one.
`current`: the same, compared at the precision of the pin (a `2.1` pin is
current against a `2.1.11` point release). `upgrade-available`: a newer
version is published and nothing holds the pin. `held`: a newer version is
published and the entry says why the site stays.
