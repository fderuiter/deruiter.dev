[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / OmnibarAction

# Type Alias: OmnibarAction

> **OmnibarAction** = \{ `formId`: `string`; `kind`: `"open_form"`; \} \| \{ `fieldId`: `string`; `formId`: `string`; `kind`: `"open_field"`; `sectionId`: `string`; \} \| \{ `kind`: `"open_visit"`; `visitId`: `string`; \} \| \{ `command`: [`SlashCommandItem`](../../smart-blocks-engine/interfaces/SlashCommandItem.md); `formId`: `string`; `kind`: `"insert"`; \} \| \{ `kind`: `"switch_mode"`; `mode`: [`StudioMode`](../../types/type-aliases/StudioMode.md); \} \| \{ `kind`: `"open_export_document"`; \} \| \{ `kind`: `"open_review_package"`; \}

What happens when an omnibar entry is chosen.
