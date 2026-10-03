[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / Bond

# Interface: Bond

A member's working relationship with the Study Director. Stored in the
world save; everything else about a person is derived from the study.

## Properties

### askedDay

> **askedDay**: `number`

Day the player last asked them for status, or 0.

***

### coached

> **coached**: `number`

Times the player has coached them.

***

### coachedDay

> **coachedDay**: `number`

Day the player last coached them, or 0.

***

### confidence

> **confidence**: `number`

Confidence in their own work, 0 to 100. Coaching builds it.

***

### owns

> **owns**: `"queries"` \| `"analysis"` \| `"programming"` \| `"monitoring"` \| `"training"` \| `"writing"` \| `null`

The stream they run without being asked, once invested in.

***

### talkedDay

> **talkedDay**: `number`

Day the player last talked with them, or 0.

***

### trust

> **trust**: `number`

Trust in the Study Director, 0 to 100.
