[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / TlfTable

# Interface: TlfTable

A table as a render model, which the HTML and RTF writers read and a page
can render directly.

## Properties

### columns

> `readonly` **columns**: readonly [`TlfColumn`](TlfColumn.md)[]

Treatment columns, in protocol order.

***

### displayId

> `readonly` **displayId**: `string`

The ARS display.

***

### fileBase

> `readonly` **fileBase**: `string`

File name without extension, for example `t-14-1-1`.

***

### footnotes

> `readonly` **footnotes**: readonly `string`[]

Footnotes, in order.

***

### notice

> `readonly` **notice**: `string`

The synthetic-data notice.

***

### number

> `readonly` **number**: `string`

Table number, for example `14.1.1`.

***

### outputId

> `readonly` **outputId**: `string`

The ARS output.

***

### population

> `readonly` **population**: `string`

Population line, for example `Safety Set`.

***

### sections

> `readonly` **sections**: readonly [`TlfSection`](TlfSection.md)[]

Row blocks, in display order.

***

### stubHeader

> `readonly` **stubHeader**: `string`

Header of the row-label column.

***

### title

> `readonly` **title**: `string`

Title.
