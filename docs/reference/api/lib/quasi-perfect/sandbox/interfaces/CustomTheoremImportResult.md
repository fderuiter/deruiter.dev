[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / CustomTheoremImportResult

# Interface: CustomTheoremImportResult

Outcome of [importCustomTheorems](../functions/importCustomTheorems.md).

## Properties

### error?

> `optional` **error?**: `string`

Set when the file as a whole could not be read; nothing is imported then.

***

### imported

> **imported**: `number`

How many entries were added.

***

### theorems

> **theorems**: [`CustomTheorem`](CustomTheorem.md)[]

The collection after the import; the input collection when nothing was added.

***

### warnings

> **warnings**: `string`[]

One line per skipped entry: invalid, a duplicate, or over the cap.
