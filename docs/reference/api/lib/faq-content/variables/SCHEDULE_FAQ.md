[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/faq-content](../README.md) / SCHEDULE\_FAQ

# Variable: SCHEDULE\_FAQ

> `const` **SCHEDULE\_FAQ**: readonly [`FAQItem`](../../seo/interfaces/FAQItem.md)[]

Single source of truth for the visible FAQ modules (ADR 0053 section 4).

The same array feeds both the on-page accordion and the FAQPage JSON-LD, so
the structured data can never describe content a visitor cannot see
(Google's anti-cloaking rule for FAQ rich results).
