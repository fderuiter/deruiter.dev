"use client";

import React, { useId, type ReactNode } from "react";

export interface FormFieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: "true";
  required?: boolean;
}

export interface FormFieldProps {
  /** Optional explicit identifier. Defaults to a deterministic identifier generated via React useId(). */
  id?: string;
  /** Visible label content */
  label: ReactNode;
  /** Optional explicit htmlFor if target control ID differs from field id */
  htmlFor?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Optional description or instructional text displayed beneath the control */
  description?: ReactNode;
  /** Optional validation error message displayed beneath the control */
  error?: ReactNode;
  /** Explicit override for validation failure status (defaults to Boolean(error)) */
  invalid?: boolean;
  /** Additional elements to render in the label row (e.g. counters, badges, action buttons) */
  labelExtra?: ReactNode;
  /** Class name applied to the outer container */
  className?: string;
  /** Class name applied to the <label> element */
  labelClassName?: string;
  /** Class name applied to the description element */
  descriptionClassName?: string;
  /** Class name applied to the error element */
  errorClassName?: string;
  /** Control element or render function receiving control props */
  children: ReactNode | ((props: FormFieldControlProps) => ReactNode);
}

/**
 * Reusable accessible form field component that establishes programmatic label associations
 * via htmlFor, binds error and instructional descriptions using aria-describedby, and reflects
 * invalid validation states using aria-invalid (WCAG 2.2 SC 1.3.1, SC 3.3.2, SC 4.1.2, Technique H44).
 */
export function FormField({
  id: explicitId,
  label,
  htmlFor,
  required = false,
  description,
  error,
  invalid,
  labelExtra,
  className = "",
  labelClassName,
  descriptionClassName = "text-[10px] text-zinc-500 mt-1 font-sans",
  errorClassName = "text-[10px] text-red-400 font-mono mt-1",
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const sanitizedId = `crf-field-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const controlId = explicitId ?? sanitizedId;
  const targetId = htmlFor ?? controlId;

  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  const describedByParts = [errorId, descriptionId].filter(Boolean);
  const ariaDescribedBy =
    describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  const isInvalid = invalid !== undefined ? invalid : Boolean(error);

  const controlProps: FormFieldControlProps = {
    id: controlId,
    ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
    ...(isInvalid ? { "aria-invalid": "true" } : {}),
    ...(required ? { required: true } : {}),
  };

  let renderedChild: ReactNode;
  if (typeof children === "function") {
    renderedChild = children(controlProps);
  } else if (React.isValidElement(children)) {
    const childProps = (children.props ?? {}) as Record<string, unknown>;
    const childDescribedBy = childProps["aria-describedby"] as
      string | undefined;
    const mergedDescribedBy =
      [ariaDescribedBy, childDescribedBy].filter(Boolean).join(" ") ||
      undefined;

    const childInvalid = childProps["aria-invalid"];
    const mergedInvalid =
      isInvalid || childInvalid === true || childInvalid === "true"
        ? "true"
        : undefined;

    renderedChild = React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      {
        id: childProps.id ?? controlId,
        ...(mergedDescribedBy ? { "aria-describedby": mergedDescribedBy } : {}),
        ...(mergedInvalid ? { "aria-invalid": mergedInvalid } : {}),
        ...(required && childProps.required === undefined
          ? { required: true }
          : {}),
      }
    );
  } else {
    renderedChild = children;
  }

  const defaultLabelClass = labelExtra
    ? "block text-[11px] font-mono text-zinc-400"
    : "block text-[11px] font-mono text-zinc-400 mb-1";
  const finalLabelClass = labelClassName ?? defaultLabelClass;

  const renderLabelContent = () => {
    return (
      <>
        {label}
        {required && typeof label === "string" && !label.includes("*") && (
          <span className="text-brand-cyan" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </>
    );
  };

  return (
    <div className={className}>
      {labelExtra ? (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={targetId} className={finalLabelClass}>
            {renderLabelContent()}
          </label>
          {labelExtra}
        </div>
      ) : (
        <label htmlFor={targetId} className={finalLabelClass}>
          {renderLabelContent()}
        </label>
      )}

      {renderedChild}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className={errorClassName}
        >
          {error}
        </p>
      )}

      {description && (
        <p id={descriptionId} className={descriptionClassName}>
          {description}
        </p>
      )}
    </div>
  );
}
