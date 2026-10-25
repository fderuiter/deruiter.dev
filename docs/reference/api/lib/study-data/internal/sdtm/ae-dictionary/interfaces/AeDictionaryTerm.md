[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/sdtm/ae-dictionary](../README.md) / AeDictionaryTerm

# Interface: AeDictionaryTerm

The study's fictional adverse event dictionary, in MedDRA's five-level
shape. Preferred terms and system organ classes reuse the MedDRA-style
names the generator has always written, so AESOC equals AEBODSYS. The
lower and group level names are invented, and every code is synthetic:
codes start at 99000000 so none can be mistaken for a MedDRA code.
MedDRA is licensed, and the package ships none of its content.

## Properties

### hlgt

> `readonly` **hlgt**: `string`

***

### hlgtcd

> `readonly` **hlgtcd**: `number`

***

### hlt

> `readonly` **hlt**: `string`

***

### hltcd

> `readonly` **hltcd**: `number`

***

### llt

> `readonly` **llt**: `string`

Lowest level term; each one shares its preferred term's name and code.

***

### lltcd

> `readonly` **lltcd**: `number`

***

### pt

> `readonly` **pt**: `string`

Preferred term, written to AEDECOD.

***

### ptcd

> `readonly` **ptcd**: `number`

***

### soc

> `readonly` **soc**: `string`

Primary system organ class, written to AEBODSYS and AESOC.

***

### soccd

> `readonly` **soccd**: `number`
