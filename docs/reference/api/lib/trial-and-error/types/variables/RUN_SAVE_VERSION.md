[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/trial-and-error/types](../README.md) / RUN\_SAVE\_VERSION

# Variable: RUN\_SAVE\_VERSION

> `const` **RUN\_SAVE\_VERSION**: `4` = `4`

The save format's current version. v2 (#2055) shuffles each Blind's deck;
a v1 save migrates to v2 with `dealing: "AUTHORED"`. v3 (#2082) adds the
run deck; a v2 save migrates to v3 with `decks: "AUTHORED"`. v4 (#2083)
gives each act its own shop and draws relics by rarity; a v3 save
migrates to v4 with `shops: "CLASSIC"`.
