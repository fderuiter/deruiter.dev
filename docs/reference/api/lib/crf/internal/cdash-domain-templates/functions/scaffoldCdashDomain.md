[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/cdash-domain-templates](../README.md) / scaffoldCdashDomain

# Function: scaffoldCdashDomain()

> **scaffoldCdashDomain**(`domainCode`, `idStamp?`): [`CRFForm`](../../../types/interfaces/CRFForm.md)

1-Click CDASH Domain Auto-Scaffolder Generator

## Parameters

### domainCode

`"DM"` \| `"VS"` \| `"AE"` \| `"LB"` \| `"CM"` \| `"EX"` \| `"DS"` \| `"MH"` \| `"RECIST"` \| `"DI"` \| `"DU"` \| `"DE"` \| `"DA"`

### idStamp?

`number` = `...`

Number appended to every generated id. The studio leaves
it to the clock so a form added twice gets distinct ids; presets pass a
fixed stamp so the same preset always builds the same study (#3051).

## Returns

[`CRFForm`](../../../types/interfaces/CRFForm.md)
