[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsNestedWhereClause

# Type Alias: ArsNestedWhereClause

> **ArsNestedWhereClause** = [`ArsWhereClause`](ArsWhereClause.md) & `object`

A where clause inside a compound expression, with its position: `level`
is one more than the level of the clause that holds it, and `order` its
place among its siblings, from 1. ARS 1.0 requires both.

## Type Declaration

### level

> `readonly` **level**: `number`

Nesting level: 2 under a top-level entity, 3 below that.

### order

> `readonly` **order**: `number`

Position among its siblings, from 1.
