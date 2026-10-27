[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-templates](../README.md) / SaveFormTemplatesResult

# Type Alias: SaveFormTemplatesResult

> **SaveFormTemplatesResult** = \{ `status`: `"saved"`; \} \| \{ `max`: `number`; `status`: `"limit"`; \} \| \{ `status`: `"unavailable"`; \} \| \{ `message`: `string`; `status`: `"error"`; \}

Outcome of a write to the template store.
