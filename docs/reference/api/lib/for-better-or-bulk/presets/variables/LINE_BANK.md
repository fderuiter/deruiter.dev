[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/presets](../README.md) / LINE\_BANK

# Variable: LINE\_BANK

> `const` **LINE\_BANK**: readonly [`BankLine`](../interfaces/BankLine.md)[]

Every line the game may show, each tagged [Real] or [Fiction] as in the
design doc. A real line quotes its fact from section 1 of the design doc
word for word (the repo checks this against a copy of that section, in
`__tests__/fixtures/for-better-or-bulk-real-facts.ts`); a fiction line claims
nothing about the real wedding.
