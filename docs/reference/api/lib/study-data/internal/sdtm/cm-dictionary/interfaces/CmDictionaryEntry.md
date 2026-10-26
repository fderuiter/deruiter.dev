[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/sdtm/cm-dictionary](../README.md) / CmDictionaryEntry

# Interface: CmDictionaryEntry

The study's fictional drug dictionary, in WHODrug's shape: a reported
medication name is coded to a standardized name and a therapeutic class.
The standardized names are generic (nonproprietary) drug names and the
class names are plain descriptions; the class codes are synthetic and
start with Z, a letter the ATC classification does not use, so none can
be mistaken for an ATC or WHODrug code. WHODrug is licensed, and the
package ships none of its content.

## Properties

### cls

> `readonly` **cls**: `string`

Therapeutic class, written to CMCLAS.

***

### clscd

> `readonly` **clscd**: `string`

Synthetic class code, written to CMCLASCD.

***

### decod

> `readonly` **decod**: `string`

Standardized medication name, written to CMDECOD.

***

### reported

> `readonly` **reported**: `string`

The name as the site reports it, written to CMTRT.
