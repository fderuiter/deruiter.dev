[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / Consumable

# Type Alias: Consumable

> **Consumable** = \{ `id`: `string`; `kind`: `"SEAL"`; `seal`: [`FootnoteSeal`](../../../types/type-aliases/FootnoteSeal.md); \} \| \{ `guidance`: [`GuidanceCard`](../../../types/type-aliases/GuidanceCard.md); `id`: `string`; `kind`: `"GUIDANCE"`; \} \| \{ `amendment`: [`SapAmendment`](../../../types/type-aliases/SapAmendment.md); `id`: `string`; `kind`: `"AMENDMENT"`; \}

A consumable in the tray: a footnote seal, a Guidance card or a SAP
Amendment. `id` is unique within the tray.
