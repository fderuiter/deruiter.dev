"use client";

import React, {
  createContext,
  useContext,
  useId,
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";

export interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: "horizontal" | "vertical";
  baseId: string;
  getTriggerId: (value: string) => string;
  getContentId: (value: string) => string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(
      "Tabs compound components must be used within a <Tabs> container."
    );
  }
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  id?: string;
  children: React.ReactNode;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      orientation = "horizontal",
      id: customId,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const rawId = useId();
    const baseId = customId || `tabs-${rawId.replace(/:/g, "")}`;

    const [uncontrolledValue, setUncontrolledValue] = useState<string>(
      defaultValue || ""
    );

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [isControlled, onValueChange]
    );

    const getTriggerId = useCallback(
      (val: string) => `${baseId}-trigger-${val}`,
      [baseId]
    );

    const getContentId = useCallback(
      (val: string) => `${baseId}-content-${val}`,
      [baseId]
    );

    const contextValue: TabsContextValue = {
      value,
      onValueChange: handleValueChange,
      orientation,
      baseId,
      getTriggerId,
      getContentId,
    };

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = "Tabs";

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: React.ReactNode;
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  (
    {
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      children,
      className,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const { orientation } = useTabsContext();
    const internalRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => internalRef.current!);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!internalRef.current) {
        onKeyDown?.(event);
        return;
      }

      const tabs = Array.from(
        internalRef.current.querySelectorAll<HTMLButtonElement>(
          '[role="tab"]:not([disabled])'
        )
      );

      if (tabs.length === 0) {
        onKeyDown?.(event);
        return;
      }

      const activeElement = document.activeElement as HTMLButtonElement | null;
      const currentIndex = tabs.findIndex((tab) => tab === activeElement);

      let nextIndex = -1;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        nextIndex =
          currentIndex < 0
            ? tabs.length - 1
            : (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        event.preventDefault();
        nextIndex = 0;
      } else if (event.key === "End") {
        event.preventDefault();
        nextIndex = tabs.length - 1;
      }

      if (nextIndex >= 0 && nextIndex < tabs.length) {
        const nextTab = tabs[nextIndex];
        nextTab.focus();
        nextTab.click();
      }

      onKeyDown?.(event);
    };

    return (
      <div
        ref={internalRef}
        role="tablist"
        aria-orientation={orientation}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  (
    {
      value: triggerValue,
      disabled = false,
      children,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const {
      value: selectedValue,
      onValueChange,
      getTriggerId,
      getContentId,
    } = useTabsContext();

    const isSelected = selectedValue === triggerValue;
    const triggerId = getTriggerId(triggerValue);
    const contentId = getContentId(triggerValue);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!disabled && !event.defaultPrevented) {
        onValueChange(triggerValue);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={triggerId}
        aria-controls={contentId}
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        disabled={disabled}
        onClick={handleClick}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
  children?: React.ReactNode;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  (
    { value: contentValue, forceMount = false, children, className, ...props },
    ref
  ) => {
    const {
      value: selectedValue,
      getTriggerId,
      getContentId,
    } = useTabsContext();

    const isSelected = selectedValue === contentValue;
    const triggerId = getTriggerId(contentValue);
    const contentId = getContentId(contentValue);

    if (!isSelected && !forceMount) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={contentId}
        aria-labelledby={triggerId}
        tabIndex={0}
        hidden={!isSelected}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = "TabsContent";
