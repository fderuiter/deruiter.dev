[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/delegation](../README.md) / delegate

# Function: delegate()

> **delegate**(`world`, `memberId`, `verb`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<[`DelegationOutcome`](../../../types/interfaces/DelegationOutcome.md)\>

One delegation verb on a member, translated into world and domain calls:

- ask status: ten minutes; they say what they are on, and it counts as a talk.
- assign: ten minutes; their stream's next piece of work lands over the
  following nights through their capacity. Their workload rises now
  (recorded with `resolveDecision`, so the domain sees a delegation), and
  dumping work on someone overloaded costs trust.
- review: twenty minutes; reviewing work that has landed is follow-through
  and builds trust; reviewing work still in progress is micromanagement.
- coach: forty-five minutes; trust and confidence rise, and a member
  coached twice who trusts you takes ownership of their stream.
- escalate: ten minutes; you ask your boss for contract help, which costs
  the budget and takes load off them. Welcome if they were struggling,
  going over their head if not.
- take over: an hour of demanding work; you clear some of their stream
  yourself. It takes load off them, and overriding an owner costs trust.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### memberId

`string`

### verb

`"assign"` \| `"askStatus"` \| `"review"` \| `"coach"` \| `"escalate"` \| `"takeOver"`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<[`DelegationOutcome`](../../../types/interfaces/DelegationOutcome.md)\>
