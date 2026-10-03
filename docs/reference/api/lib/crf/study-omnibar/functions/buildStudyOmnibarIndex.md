[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-omnibar](../README.md) / buildStudyOmnibarIndex

# Function: buildStudyOmnibarIndex()

> **buildStudyOmnibarIndex**(`study`, `options?`): [`OmnibarEntry`](../interfaces/OmnibarEntry.md)[]

Builds the omnibar index for a study.

Forms name their domain and the visits that collect them; fields name the
form and section that own them; visits name their study day and the forms
they collect. Insert actions name the form (and section) they target and
are included only when [verifyStarterInsertion](verifyStarterInsertion.md) passes.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

The study to index.

### options?

[`BuildStudyOmnibarIndexOptions`](../interfaces/BuildStudyOmnibarIndexOptions.md) = `{}`

Insertion target for insert actions.

## Returns

[`OmnibarEntry`](../interfaces/OmnibarEntry.md)[]

Every searchable entry, in default display order.
