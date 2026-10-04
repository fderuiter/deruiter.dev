[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/oss-credits/presets](../README.md) / LICENSE\_TEXT\_INHERITANCE

# Variable: LICENSE\_TEXT\_INHERITANCE

> `const` **LICENSE\_TEXT\_INHERITANCE**: readonly `object`[]

Packages that publish no license file of their own but come from a parent
package that does (one repository, one license). They reuse the parent's text
so the notice carries the real copyright holder. `prefix` matches the start of
a package name; `name` matches exactly. The parent must be in the lockfile
and ship a license file, or generation fails.
