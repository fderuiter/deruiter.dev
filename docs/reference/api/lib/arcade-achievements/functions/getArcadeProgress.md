[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / getArcadeProgress

# Function: getArcadeProgress()

> **getArcadeProgress**(): [`ArcadeProgress`](../../arcade/progress/core/interfaces/ArcadeProgress.md)

Reads the current Arcade progress from the `arcade.core` slice. The
first read after an upgrade folds the old per-game score keys in once.
Returns a copy the caller may change and pass to saveArcadeProgress.

## Returns

[`ArcadeProgress`](../../arcade/progress/core/interfaces/ArcadeProgress.md)
