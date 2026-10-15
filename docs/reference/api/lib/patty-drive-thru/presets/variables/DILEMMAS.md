[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/presets](../README.md) / DILEMMAS

# Variable: DILEMMAS

> `const` **DILEMMAS**: `Readonly`\<`Record`\<[`DilemmaId`](../../types/type-aliases/DilemmaId.md), [`Dilemma`](../../types/interfaces/Dilemma.md)\>\>

The hand-written dilemmas (#2087). Each trades the meters against each
other and moves the hidden Solidarity value. The default, taken when the
timer runs out, is what happens if nobody says anything; it moves the
meters but not Solidarity, so a player who ignores them clocks out
quietly (#2139). Every dilemma has an answer worth at least 10 toward the
crew and one worth at least 10 toward management, so any three a shift
draws can reach either named ending.
