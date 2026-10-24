[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/outputs](../README.md) / writeTlfFiles

# Function: writeTlfFiles()

> **writeTlfFiles**(`outputs`): readonly [`PackageFile`](../../../export/package/interfaces/PackageFile.md)[]

Every output of [buildTlfOutputs](buildTlfOutputs.md) as a file: each table as HTML and
RTF, each figure as HTML (with its data tables) and SVG, and the reporting
event as JSON, all under [TLF\_OUTPUT\_DIR](../variables/TLF_OUTPUT_DIR.md).
Files are in path order and hold no timestamps.

## Parameters

### outputs

[`TlfOutputs`](../../../../types/interfaces/TlfOutputs.md)

## Returns

readonly [`PackageFile`](../../../export/package/interfaces/PackageFile.md)[]
