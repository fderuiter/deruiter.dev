import React from "react";
import { cn } from "@/lib/utils";

interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Layout presentation variant:
   * - `standard`: Centered max-w-7xl layout with responsive top and bottom padding.
   * - `studio`: Full-width flex column layout for complex interactive canvases and simulation panels.
   * - `full`: Unconstrained full-bleed container with base dynamic viewport height (min-h-dvh).
   */
  variant?: "standard" | "studio" | "full";
  /**
   * Container HTML tag (defaults to 'div' to prevent nesting duplicate <main> landmarks).
   */
  as?: "div" | "section" | "article";
}

/**
 * Standard page layout wrapper enforcing responsive container constraints,
 * dynamic viewport height adaptation (`min-h-dvh`), and zero horizontal overflow.
 */
export function PageLayout({
  children,
  variant = "standard",
  as: Component = "div",
  className,
  ...props
}: PageLayoutProps) {
  const variantStyles = {
    standard:
      "min-h-dvh w-full overflow-x-hidden pt-28 sm:pt-32 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col scrollbar-gutter-stable",
    studio:
      "min-h-dvh w-full overflow-x-hidden pt-28 pb-16 px-4 sm:px-6 lg:px-8 flex flex-col flex-1 scrollbar-gutter-stable",
    full: "min-h-dvh w-full overflow-x-hidden flex flex-col scrollbar-gutter-stable",
  };

  return (
    <Component className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </Component>
  );
}

export default PageLayout;
