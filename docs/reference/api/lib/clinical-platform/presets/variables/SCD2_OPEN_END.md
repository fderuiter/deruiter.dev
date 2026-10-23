[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/presets](../README.md) / SCD2\_OPEN\_END

# Variable: SCD2\_OPEN\_END

> `const` **SCD2\_OPEN\_END**: `"9999-12-31"` = `"9999-12-31"`

`valid_to` of the version of a slowly changing dimension member that is
still in force. A far-future date rather than `null`, so a join on
`date >= valid_from AND date < valid_to` needs no null test.
