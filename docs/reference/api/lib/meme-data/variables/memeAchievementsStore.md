[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-data](../README.md) / memeAchievementsStore

# Variable: memeAchievementsStore

> `const` **memeAchievementsStore**: [`ArcadeStore`](../../arcade/progress/store/interfaces/ArcadeStore.md)\<readonly `string`[]\>

The Meme Vault trophies found in this browser (#2371): a plain JSON array
of ids, the same bytes the vault always wrote. Anything else stored there
is set aside under `meme_achievements_unlocked:corrupt` and reads empty.
