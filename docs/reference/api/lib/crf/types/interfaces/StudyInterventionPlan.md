[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/types](../README.md) / StudyInterventionPlan

# Interface: StudyInterventionPlan

A drug, biologic or device the protocol gives to subjects.

## Properties

### administrationFormIds?

> `optional` **administrationFormIds?**: `string`[]

The forms that record it being given.

***

### armIds?

> `optional` **armIds?**: `string`[]

The arms that receive it; every arm when omitted.

***

### description?

> `optional` **description?**: `string`

***

### id

> **id**: `string`

***

### name

> **name**: `string`

***

### procedure?

> `optional` **procedure?**: `object`

The NCI-coded procedure that gives it. Defaults to Medication
Administration (C128534).

#### code

> **code**: `string`

#### name

> **name**: `string`

***

### role

> **role**: [`StudyInterventionRole`](../type-aliases/StudyInterventionRole.md)

***

### type

> **type**: [`StudyInterventionType`](../type-aliases/StudyInterventionType.md)
