[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-baseline-diff](../README.md) / compareStudyToBaseline

# Function: compareStudyToBaseline()

> **compareStudyToBaseline**(`current`, `baselineStudy`, `baselineMeta`, `options?`): [`BaselineComparisonResult`](../interfaces/BaselineComparisonResult.md)

Compares the current working draft against another study snapshot.

Within one study every object is matched by its stable id (never by array
position), so reorders never masquerade as adds/removes, and a same-id
rename or move is a single "modified" entry. When the two studies have
different ids (or `options.crossStudy` is set), ids mean nothing across
them, so objects that do not share an id are paired by name instead
(form OID, domain and name, variable name, section title, NCI code) when
the name is unambiguous, and id references compare by what they point at.

## Parameters

### current

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### baselineStudy

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### baselineMeta

#### id

`string`

#### label

`string`

#### versionTag

`string`

### options?

#### crossStudy?

`boolean`

## Returns

[`BaselineComparisonResult`](../interfaces/BaselineComparisonResult.md)
