[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/stats](../README.md) / STATISTIC\_PRECISION

# Variable: STATISTIC\_PRECISION

> `const` **STATISTIC\_PRECISION**: `Readonly`\<\{ `max`: \{ `decimals`: `0`; `relativeTo`: `"data"`; \}; `mean`: \{ `decimals`: `1`; `relativeTo`: `"data"`; \}; `median`: \{ `decimals`: `1`; `relativeTo`: `"data"`; \}; `min`: \{ `decimals`: `0`; `relativeTo`: `"data"`; \}; `n`: \{ `decimals`: `0`; `relativeTo`: `"integer"`; \}; `percent`: \{ `decimals`: `1`; `relativeTo`: `"fixed"`; \}; `sd`: \{ `decimals`: `2`; `relativeTo`: `"data"`; \}; \}\>

How many decimals each statistic is shown with, relative to the data:
counts as integers, minimum and maximum as the data, mean and median one
more, SD two more, and percentages to one decimal whatever the data.
