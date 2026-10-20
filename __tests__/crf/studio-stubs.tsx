import React from "react";

/**
 * Stand-ins for CRF Studio's panels, so a test can check how the container
 * wires them without paying for each panel's own rendering. Each stub records
 * the props it last received and renders one button per callback prop, named
 * "<Panel>.<prop>", which calls the callback with the arguments queued in
 * `stubArgs`.
 */
export const stubProps: Record<string, Record<string, unknown>> = {};
export const stubArgs: Record<string, unknown[]> = {};

export function resetStubs() {
  for (const key of Object.keys(stubProps)) delete stubProps[key];
  for (const key of Object.keys(stubArgs)) delete stubArgs[key];
}

export function stubComponent(name: string) {
  function Stub(props: Record<string, unknown>) {
    stubProps[name] = props;
    return (
      <div data-testid={`stub-${name}`}>
        {Object.entries(props)
          .filter(([, value]) => typeof value === "function")
          .map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                (value as (...args: unknown[]) => void)(
                  ...(stubArgs[`${name}.${key}`] ?? [])
                )
              }
            >
              {`${name}.${key}`}
            </button>
          ))}
      </div>
    );
  }
  Stub.displayName = `Stub(${name})`;
  return Stub;
}
