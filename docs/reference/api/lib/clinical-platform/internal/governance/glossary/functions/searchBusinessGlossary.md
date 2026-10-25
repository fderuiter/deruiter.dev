[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/governance/glossary](../README.md) / searchBusinessGlossary

# Function: searchBusinessGlossary()

> **searchBusinessGlossary**(`entries`, `text`): [`BusinessGlossaryEntry`](../../../../types/interfaces/BusinessGlossaryEntry.md)[]

Searches the business glossary. Every word of `text` must appear in the
term, a synonym, the definition, the source or the id of a metric that
links it, ignoring case. An empty search matches every entry.

## Parameters

### entries

readonly [`BusinessGlossaryEntry`](../../../../types/interfaces/BusinessGlossaryEntry.md)[]

Entries from `businessGlossary`.

### text

`string`

The search.

## Returns

[`BusinessGlossaryEntry`](../../../../types/interfaces/BusinessGlossaryEntry.md)[]

The matching entries, in their glossary order.
