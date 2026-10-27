[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardCheckKind

# Type Alias: StandardCheckKind

> **StandardCheckKind** = `"cdisc-engine"` \| `"official-schema"` \| `"local-rules"` \| `"terminology"`

What a check is. `cdisc-engine`: CDISC's own rules engine (CORE).
`official-schema`: a schema CDISC publishes, vendored and validated
against. `local-rules`: rules or tests written here, which CDISC has not
reviewed. `terminology`: codes checked against the NCI EVS release.
