[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/ram](../README.md) / describeModeRules

# Function: describeModeRules()

> **describeModeRules**(`mode`, `level?`): [`ModeRuleCopy`](../interfaces/ModeRuleCopy.md)

Single source of truth for the RAM rules shown in the HUD, the Theory
Briefing and the manual. Both modes behave identically apart from the
starting budget: a failed tactic costs RAM, and 0 GB stops the session.

## Parameters

### mode

[`GameMode`](../../types/type-aliases/GameMode.md)

Story or Hacker mode.

### level?

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"initialRam"`\>

When given, the budget names the exact starting GB.

## Returns

[`ModeRuleCopy`](../interfaces/ModeRuleCopy.md)

The copy for that mode.
