[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/recorded](../README.md) / RecordedScenarioView

# Interface: RecordedScenarioView

A scenario view, as its change to the default view's SDTM findings.

## Properties

### added

> `readonly` **added**: [`RecordedLines`](RecordedLines.md)

***

### inputSha256

> `readonly` **inputSha256**: `string`

***

### removed

> `readonly` **removed**: [`RecordedLines`](RecordedLines.md)

***

### status

> `readonly` **status**: `Readonly`\<`Record`\<`string`, `string`\>\>

SDTM rules whose status differs from the default view's.
