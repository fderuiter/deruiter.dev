[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/types](../README.md) / StudyImportResult

# Type Alias: StudyImportResult

> **StudyImportResult** = \{ `report`: [`StudyImportReport`](../interfaces/StudyImportReport.md); `status`: `"ok"`; `workspace`: [`StudyWorkspace`](../interfaces/StudyWorkspace.md); \} \| \{ `choices`: readonly [`StudyVersionChoice`](../interfaces/StudyVersionChoice.md)[]; `status`: `"needs-selection"`; \} \| \{ `problems`: readonly [`StudyImportProblem`](StudyImportProblem.md)[]; `status`: `"rejected"`; \}

The result of importing a USDM document.
