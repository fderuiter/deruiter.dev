[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-workspace/types](../README.md) / StudyImportReport

# Interface: StudyImportReport

What an import found.

## Properties

### counts

> `readonly` **counts**: [`StudyContentCounts`](StudyContentCounts.md)

***

### preserved

> `readonly` **preserved**: readonly [`PreservedItem`](PreservedItem.md)[]

***

### schemaIssues

> `readonly` **schemaIssues**: readonly `string`[]

Schema issues as `path: message`; the import still succeeds.
