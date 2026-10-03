[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / findFormReferenceIssues

# Function: findFormReferenceIssues()

> **findFormReferenceIssues**(`study`, `form`): [`FormReferenceIssue`](../interfaces/FormReferenceIssue.md)[]

Lists the field references in a form's rules that resolve to no field of
that form or of any other form in the study. Formula strings are not
parsed, so only rule targets, triggers and conditions are checked.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### form

[`CRFForm`](../../types/interfaces/CRFForm.md)

## Returns

[`FormReferenceIssue`](../interfaces/FormReferenceIssue.md)[]
