[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WorkbenchSqlFinding

# Interface: WorkbenchSqlFinding

Why SQL typed into the workbench will not run (#2633).

## Properties

### message

> `readonly` **message**: `string`

What is wrong, in a sentence a visitor can act on.

***

### rule

> `readonly` **rule**: `"empty"` \| `"unterminated"` \| `"multiple-statements"` \| `"not-a-query"` \| `"forbidden-keyword"` \| `"external-read"`
