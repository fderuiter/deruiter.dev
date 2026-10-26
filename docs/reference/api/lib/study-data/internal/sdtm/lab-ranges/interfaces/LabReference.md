[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/sdtm/lab-ranges](../README.md) / LabReference

# Interface: LabReference

The fictional central laboratory's category and reference range for each
test, in the test's standard unit. The ranges sit close to common adult
ranges and are set so that every result the generator flags NORMAL falls
inside them and every result it flags HIGH falls above them.

## Properties

### category

> `readonly` **category**: `"CHEMISTRY"` \| `"HEMATOLOGY"`

LBCAT: the laboratory panel the test belongs to.

***

### high

> `readonly` **high**: `number`

***

### low

> `readonly` **low**: `number`
