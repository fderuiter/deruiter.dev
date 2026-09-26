[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / resolveLoonCollision

# Function: resolveLoonCollision()

> **resolveLoonCollision**(`input`): [`LoonCollisionResult`](../interfaces/LoonCollisionResult.md)

Resolves contact between the loon and live, unfrozen enemies.

Frozen enemies are harmless ice. A regular enemy that touches the loon is
knocked out without scoring; a boss stays. The Pronto Pup shield absorbs
contact, and after a hit enemies pass through the loon until the
invulnerability window ends.

## Parameters

### input

[`LoonCollisionInput`](../interfaces/LoonCollisionInput.md)

## Returns

[`LoonCollisionResult`](../interfaces/LoonCollisionResult.md)
