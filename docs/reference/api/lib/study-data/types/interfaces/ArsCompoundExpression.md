[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsCompoundExpression

# Interface: ArsCompoundExpression

Where clauses joined by AND or OR, or one negated by NOT.

## Properties

### logicalOperator

> `readonly` **logicalOperator**: `"AND"` \| `"OR"` \| `"NOT"`

The logical operator. NOT takes exactly one clause.

***

### whereClauses

> `readonly` **whereClauses**: readonly [`ArsWhereClause`](../type-aliases/ArsWhereClause.md)[]

The clauses it joins.
