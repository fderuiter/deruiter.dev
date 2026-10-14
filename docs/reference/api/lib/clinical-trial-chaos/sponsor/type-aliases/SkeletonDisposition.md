[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / SkeletonDisposition

# Type Alias: SkeletonDisposition

> **SkeletonDisposition** = `"disclosed"` \| `"misidentified"` \| `"evasive"` \| `"unanswered"`

How the player answered the inspector's question about one sponsor
skeleton in the campaign-finale inspection (#2089):

- `disclosed`: owned it and cited the right regulation. Half the penalty,
  and the finding drops one severity level.
- `misidentified`: owned it but cited the wrong regulation. Full penalty.
- `evasive`: denied it or blamed the sponsor. Full penalty, and the finding
  rises one severity level, which can escalate the verdict.
- `unanswered`: the timer ran out. Full penalty.
