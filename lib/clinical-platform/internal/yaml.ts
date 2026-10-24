/**
 * A small block-style YAML writer for the files the platform generates (the
 * dbt MetricFlow model and the ODCS data contracts). It writes maps, lists
 * and scalars only; a string that is not a plain identifier is written as a
 * JSON string, which YAML reads as a double-quoted scalar.
 */

/** A YAML value: a scalar, a list or a map. */
export type Yaml = string | number | boolean | readonly Yaml[] | YamlMap;

/** A YAML map. Keys whose value is `undefined` are left out. */
export interface YamlMap {
  readonly [key: string]: Yaml | undefined;
}

const PLAIN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const RESERVED = /^(?:true|false|null|yes|no|on|off|y|n|~)$/i;

function scalar(value: string | number | boolean): string {
  if (typeof value !== "string") return String(value);
  return PLAIN.test(value) && !RESERVED.test(value)
    ? value
    : JSON.stringify(value);
}

function isScalar(value: Yaml): value is string | number | boolean {
  return typeof value !== "object";
}

/** Block-style YAML for a tree of maps, lists and scalars, one line per entry. */
export function yaml(value: Yaml, indent = ""): string[] {
  if (isScalar(value)) return [`${indent}${scalar(value)}`];
  if (Array.isArray(value)) {
    return (value as readonly Yaml[]).flatMap((item) => {
      if (isScalar(item)) return [`${indent}- ${scalar(item)}`];
      const [first, ...rest] = yaml(item, `${indent}  `);
      return [`${indent}- ${first.slice(indent.length + 2)}`, ...rest];
    });
  }
  return Object.entries(value as YamlMap).flatMap(([key, item]) => {
    if (item === undefined) return [];
    if (isScalar(item)) return [`${indent}${key}: ${scalar(item)}`];
    if (Array.isArray(item) && item.length === 0)
      return [`${indent}${key}: []`];
    return [`${indent}${key}:`, ...yaml(item, `${indent}  `)];
  });
}
