[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/codex](../README.md) / CodexReadStatus

# Type Alias: CodexReadStatus

> **CodexReadStatus** = `"EMPTY"` \| `"OK"` \| `"INVALID"` \| `"NEWER"`

What reading a stored Codex found. EMPTY: nothing stored. OK: a readable
Codex. INVALID: corrupt JSON or a document that fails the schema, which the
next write replaces. NEWER: a later version written by a newer build,
which this build reads as empty and must not overwrite.
