[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/project-image-service](../README.md) / ProjectImageErrorCode

# Type Alias: ProjectImageErrorCode

> **ProjectImageErrorCode** = `z.infer`\<*typeof* [`ProjectImageErrorCode`](../variables/ProjectImageErrorCode.md)\>

Error codes returned by the project image upload contract (ADR 0028).

The validation codes (`EMPTY_PAYLOAD` through `SANITIZED_SVG_EMPTY`) and
`CASE_STUDY_NOT_FOUND` describe a request the caller can correct; the
remaining codes are infrastructure failures.
