[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / ENV\_KEY\_CLASSIFICATION

# Variable: ENV\_KEY\_CLASSIFICATION

> `const` **ENV\_KEY\_CLASSIFICATION**: `Readonly`\<`Record`\<`string`, [`EnvKeyClassification`](../../types/interfaces/EnvKeyClassification.md)\>\>

Classification of every key in `.env.example`. A test asserts that each
template key appears here, so a new variable cannot slip through as an
unclassified (and therefore unredacted) value.
