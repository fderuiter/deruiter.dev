[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/stats](../README.md) / invertMatrix

# Function: invertMatrix()

> **invertMatrix**(`matrix`): `number`[][] \| `null`

Inverse of a small symmetric positive-definite matrix by Gauss-Jordan
elimination with partial pivoting.

## Parameters

### matrix

readonly (readonly `number`[])[]

Square matrix, as rows.

## Returns

`number`[][] \| `null`

The inverse, or `null` when the matrix is singular to working precision.
