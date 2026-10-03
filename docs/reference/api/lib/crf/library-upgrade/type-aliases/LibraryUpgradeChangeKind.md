[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/library-upgrade](../README.md) / LibraryUpgradeChangeKind

# Type Alias: LibraryUpgradeChangeKind

> **LibraryUpgradeChangeKind** = `"incoming"` \| `"local"` \| `"converged"` \| `"conflict"`

How a change arose.

- `incoming`: only the library changed it; the upgrade takes the library's value.
- `local`: only the study changed it; the customization is kept.
- `converged`: both made the same change; nothing to decide.
- `conflict`: both changed it differently; the author must choose.
