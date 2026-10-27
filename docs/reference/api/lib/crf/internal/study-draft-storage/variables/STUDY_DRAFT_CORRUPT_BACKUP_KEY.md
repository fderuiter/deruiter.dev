[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/study-draft-storage](../README.md) / STUDY\_DRAFT\_CORRUPT\_BACKUP\_KEY

# Variable: STUDY\_DRAFT\_CORRUPT\_BACKUP\_KEY

> `const` **STUDY\_DRAFT\_CORRUPT\_BACKUP\_KEY**: `"crf_studio_draft_v1_corrupt"` = `"crf_studio_draft_v1_corrupt"`

Backup key an unreadable/corrupt draft is copied to before the primary key
is reset, so a bad write or manual edit never silently destroys the only
copy of an author's work.
