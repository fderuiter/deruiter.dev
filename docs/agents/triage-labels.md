# Triage Labels

## Overview

The skills speak in terms of two category roles and five canonical triage (state) roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

The category roles map onto the repository's `type:*` labels:

| Role in mattpocock/skills | Label in our tracker | Meaning                        |
| ------------------------- | -------------------- | ------------------------------ |
| `bug`                     | `type:bug`           | Something is broken            |
| `enhancement`             | `type:feature`       | New feature or improvement     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

The full label set, including priority, area and execution labels, is defined in [`docs/how-to/issue-governance.md`](../how-to/issue-governance.md). Structural labels (`type:epic`, `type:initiative`, `type:portfolio`) take no triage state.
