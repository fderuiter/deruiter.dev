[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / MedallionLayer

# Type Alias: MedallionLayer

> **MedallionLayer** = `"bronze"` \| `"silver"` \| `"gold"`

Medallion layer. Bronze holds raw source feeds, silver holds conformed and
quality-checked data products, gold holds star-schema marts and the Study
Data Pipeline's SDTM and ADaM output. Data flows towards gold, never back.
