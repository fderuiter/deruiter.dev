[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ConformanceReport

# Interface: ConformanceReport

Explicit pipeline gate status and a pointer to the full CORE rule set.

## Properties

### coreUrl

> `readonly` **coreUrl**: `string`

***

### domains

> `readonly` **domains**: readonly [`ConformanceDomainSummary`](ConformanceDomainSummary.md)[]

***

### ruleResults

> `readonly` **ruleResults**: readonly [`ConformanceRuleResult`](ConformanceRuleResult.md)[]

***

### rulesVersion

> `readonly` **rulesVersion**: `string`

***

### scopeNotice

> `readonly` **scopeNotice**: `string`

***

### status

> `readonly` **status**: `"warning"` \| `"failed"` \| `"pass"`

***

### terminologyVersion

> `readonly` **terminologyVersion**: `string`
