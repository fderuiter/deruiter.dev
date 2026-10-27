[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-workspace/internal/import](../README.md) / ImportUsdmStudyOptions

# Interface: ImportUsdmStudyOptions

Options for `importUsdmStudy`.

## Properties

### fileName?

> `readonly` `optional` **fileName?**: `string`

The file name to record as the source.

***

### selection?

> `readonly` `optional` **selection?**: [`StudyWorkspaceSelection`](../../../types/interfaces/StudyWorkspaceSelection.md)

The study version and design to work on. Needed when the document has
more than one of either; the import never picks one silently.
