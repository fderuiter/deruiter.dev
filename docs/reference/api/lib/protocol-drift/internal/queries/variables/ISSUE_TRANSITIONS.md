[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/queries](../README.md) / ISSUE\_TRANSITIONS

# Variable: ISSUE\_TRANSITIONS

> `const` **ISSUE\_TRANSITIONS**: `Readonly`\<`Record`\<[`IssueStatus`](../../../types/type-aliases/IssueStatus.md), readonly [`IssueStatus`](../../../types/type-aliases/IssueStatus.md)[]\>\>

Legal issue resolution transitions. Open to ReadyForReview covers an
amended record arriving after a generic query that was not rubber-stamped;
Open and AwaitingEvidence to Resolved is reserved for the engine when a
pipeline repair or correction clears the condition on reprocessing.
