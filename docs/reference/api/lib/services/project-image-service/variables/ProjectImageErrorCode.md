[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/project-image-service](../README.md) / ProjectImageErrorCode

# Variable: ProjectImageErrorCode

> `const` **ProjectImageErrorCode**: `ZodEnum`\<\{ `CASE_STUDY_LOOKUP_FAILED`: `"CASE_STUDY_LOOKUP_FAILED"`; `CASE_STUDY_NOT_FOUND`: `"CASE_STUDY_NOT_FOUND"`; `EMPTY_PAYLOAD`: `"EMPTY_PAYLOAD"`; `FILE_TOO_LARGE`: `"FILE_TOO_LARGE"`; `MALFORMED_HEADER`: `"MALFORMED_HEADER"`; `PERSISTENCE_FAILED`: `"PERSISTENCE_FAILED"`; `SANITIZED_SVG_EMPTY`: `"SANITIZED_SVG_EMPTY"`; `STORAGE_FAILED`: `"STORAGE_FAILED"`; `UNSUPPORTED_TYPE`: `"UNSUPPORTED_TYPE"`; \}\>

Error codes returned by the project image upload contract (ADR 0028).

The validation codes (`EMPTY_PAYLOAD` through `SANITIZED_SVG_EMPTY`) and
`CASE_STUDY_NOT_FOUND` describe a request the caller can correct; the
remaining codes are infrastructure failures.
