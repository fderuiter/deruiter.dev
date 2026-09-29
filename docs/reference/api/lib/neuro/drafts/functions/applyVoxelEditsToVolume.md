[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/neuro/drafts](../README.md) / applyVoxelEditsToVolume

# Function: applyVoxelEditsToVolume()

> **applyVoxelEditsToVolume**(`volume`, `edits`): `void`

Replay voxel edits onto a volume's mutable buffers (same rule the editor
applies live) so restored drafts and undo render and score identically.

## Parameters

### volume

[`SyntheticVolume`](../../volume-generator/interfaces/SyntheticVolume.md)

### edits

[`VoxelEdit`](../../types/interfaces/VoxelEdit.md)[]

## Returns

`void`
