[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / CsrLockSchema

# Variable: CsrLockSchema

> `const` **CsrLockSchema**: `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"CSR_LOCK"`\>; `packageName`: `ZodString`; \}, `$strip`\>

CSR Lock (T&E-11, #922): the final release gate. It accepts only a CSR
Straight (ADR 0046), and the Blind is won only by locking the Clinical
Study Report package: a Straight played in pipeline order whose five
outputs reconcile (current, validated, no open findings, compiled under
the active SAP) and that reaches the quota. Changing a locked package
needs a formal protocol amendment.
