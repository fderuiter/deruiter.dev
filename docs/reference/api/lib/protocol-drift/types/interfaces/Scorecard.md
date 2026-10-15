[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / Scorecard

# Interface: Scorecard

Systems efficiency scorecard shown after lock.

## Properties

### assisted

> **assisted**: `boolean`

True when the run loaded a reference pipeline (#2168).

***

### badges

> **badges**: [`BadgeAward`](BadgeAward.md)[]

***

### chipCount

> **chipCount**: `number`

Chips in the live pipeline at lock.

***

### efficiency

> **efficiency**: [`EfficiencyMetric`](EfficiencyMetric.md)[]

Each efficiency measure against its par, in a fixed order.

***

### efficiencyScore

> **efficiencyScore**: `number`

The sum of the efficiency points.

***

### evidenceLinkedQueries

> **evidenceLinkedQueries**: `number`

***

### fabricatedBits

> **fabricatedBits**: `number`

Fabricated precision introduced over the run, in bits.

***

### goodwill

> **goodwill**: `Record`\<[`SiteId`](../type-aliases/SiteId.md), `number`\>

***

### integrityPassed

> **integrityPassed**: `boolean`

***

### meanGoodwill

> **meanGoodwill**: `number`

***

### medals

> **medals**: `number`

Measures at or under par.

***

### queriesSent

> **queriesSent**: `number`

***

### queryRestraintLabel

> **queryRestraintLabel**: `"Gold Standard Auditor"` \| `"Query Spammer"` \| `"Balanced Inquirer"` \| `"No Queries Sent"`

***

### queryRestraintRatio

> **queryRestraintRatio**: `number` \| `null`

***

### rejectedCommands

> **rejectedCommands**: `number`

Commands the engine turned down during the run.

***

### score

> **score**: `number`

The arcade score: base, badges, goodwill and efficiency together.

***

### trialDurationDays

> **trialDurationDays**: `number`

***

### wireCount

> **wireCount**: `number`

Wires in the live pipeline at lock.
