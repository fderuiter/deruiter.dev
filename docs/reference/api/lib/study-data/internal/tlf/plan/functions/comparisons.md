[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / comparisons

# Function: comparisons()

> **comparisons**(`definition`): \{ `control`: `number`; `treatments`: readonly `number`[]; \} \| `null`

The comparator of a study, by its arm type (`Placebo Comparator Arm`,
`Active Comparator Arm`), and the arms compared with it. `null` when the
study has no comparator arm or nothing to compare with it.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

## Returns

\{ `control`: `number`; `treatments`: readonly `number`[]; \} \| `null`
