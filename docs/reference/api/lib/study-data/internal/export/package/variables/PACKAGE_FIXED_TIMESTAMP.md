[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/package](../README.md) / PACKAGE\_FIXED\_TIMESTAMP

# Variable: PACKAGE\_FIXED\_TIMESTAMP

> `const` **PACKAGE\_FIXED\_TIMESTAMP**: `"1980-01-01T00:00:00Z"` = `"1980-01-01T00:00:00Z"`

Timestamp written wherever a format requires one (Dataset-JSON creation
time, XPT headers, zip entry dates): the start of the DOS date range zip
uses, so the bytes depend only on the run. The real build time is in
[PACKAGE\_TIMESTAMP\_PATH](PACKAGE_TIMESTAMP_PATH.md).
