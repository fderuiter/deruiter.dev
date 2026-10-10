[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-templates](../README.md) / listFormTemplates

# Function: listFormTemplates()

> **listFormTemplates**(`storage?`): [`FormTemplate`](../interfaces/FormTemplate.md)[]

Reads the saved templates, newest first. An absent, unavailable or
unreadable store reads as empty; an unreadable payload is copied to
[FORM\_TEMPLATES\_CORRUPT\_BACKUP\_KEY](../variables/FORM_TEMPLATES_CORRUPT_BACKUP_KEY.md) first. Entries that no longer
pass validation are left out.

## Parameters

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`FormTemplate`](../interfaces/FormTemplate.md)[]
