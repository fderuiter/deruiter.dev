[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/study-draft-storage](../README.md) / STUDY\_DRAFT\_STORAGE\_KEY

# Variable: STUDY\_DRAFT\_STORAGE\_KEY

> `const` **STUDY\_DRAFT\_STORAGE\_KEY**: `"crf_studio_draft_v1"` = `"crf_studio_draft_v1"`

localStorage key holding the author's most recently acknowledged CRF Studio
draft, wrapped in a versioned envelope so future format changes can be
detected and migrated instead of silently misread.
