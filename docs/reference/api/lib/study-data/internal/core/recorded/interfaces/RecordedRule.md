[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/recorded](../README.md) / RecordedRule

# Interface: RecordedRule

One rule's outcome in a CORE run, from its `Rules_Report`.

## Properties

### cdisc

> `readonly` **cdisc**: `string`

The CDISC conformance rule ids CORE cites (CG, TIG), comma separated.

***

### fda

> `readonly` **fda**: `string`

The FDA Business or Validator Rule ids CORE cites, comma separated.

***

### message

> `readonly` **message**: `string`

***

### status

> `readonly` **status**: `string`

SUCCESS, ISSUE REPORTED, SKIPPED (not applicable) or EXECUTION ERROR.
