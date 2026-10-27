[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/personal-library](../README.md) / LibraryInsertionConflict

# Interface: LibraryInsertionConflict

A condition that would affect an insertion. Nothing here blocks the
insertion; conflicts are resolved automatically by remapping, and are
reported so the author can see what will change before committing.

## Properties

### detail

> **detail**: `string`

***

### existing

> **existing**: `string`

The colliding value as stored in the library entry.

***

### kind

> **kind**: `"variable_name"` \| `"codelist_id"` \| `"section_title"`

***

### resolution

> **resolution**: `string`

What it will become in the target study, when remapping applies.
