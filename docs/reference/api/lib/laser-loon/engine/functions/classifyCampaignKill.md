[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / classifyCampaignKill

# Function: classifyCampaignKill()

> **classifyCampaignKill**(`target`, `actNumber`): [`CampaignKillOutcome`](../type-aliases/CampaignKillOutcome.md)

Classifies a campaign kill. Every weapon (lasers, the Cryo-Mortar and the
Tremolo ultimate) routes its kills through this, so a boss kill ends the
act whichever weapon landed it.

## Parameters

### target

`Pick`\<[`Target`](../../types/interfaces/Target.md), `"isBoss"` \| `"isProjectile"`\>

The target that was just destroyed.

### actNumber

`number`

The act being played.

## Returns

[`CampaignKillOutcome`](../type-aliases/CampaignKillOutcome.md)

`act-kill` for a regular enemy, `act-victory` for a boss before
  the final act, `campaign-victory` for the final act's boss, and
  `no-credit` for a boss volley shot, which doesn't count toward the act.
