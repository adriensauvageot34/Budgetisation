"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { initialRovingIndex, isButtonActivationKey, resolveRovingIndex } from "../../accessibility";

export type TabOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly disabledReason?: string;
};

type TabsBaseProps<Value extends string> = {
  readonly id?: string;
  readonly label: string;
  readonly value: Value;
  readonly tabs: readonly TabOption<Value>[];
  readonly onChange: (value: Value) => void;
  readonly activationMode?: "automatic" | "manual";
};

export type TabsProps<Value extends string> = TabsBaseProps<Value>;
export type SecondaryTabsProps<Value extends string> = TabsBaseProps<Value>;

function TabsBase<Value extends string>({
  label,
  value,
  tabs,
  onChange,
  activationMode = "automatic",
  id,
  secondary,
}: TabsBaseProps<Value> & { readonly secondary: boolean }) {
  const generatedId = useId();
  const groupId = id ?? `ui-tabs-${generatedId}`;
  const preferredIndex = tabs.findIndex((tab) => tab.value === value);
  const items = tabs.map((tab) => ({ disabled: tab.disabledReason !== undefined }));
  const [focusIndex, setFocusIndex] = useState(() => initialRovingIndex(items, preferredIndex));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusIndex(initialRovingIndex(items, preferredIndex));
  }, [preferredIndex, tabs]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = resolveRovingIndex(items, index, event.key, "horizontal");
    if (nextIndex !== null && nextIndex >= 0) {
      event.preventDefault();
      setFocusIndex(nextIndex);
      refs.current[nextIndex]?.focus();
      if (activationMode === "automatic") onChange(tabs[nextIndex]!.value);
      return;
    }
    if (activationMode === "manual" && isButtonActivationKey(event.key)) {
      event.preventDefault();
      if (tabs[index]?.disabledReason === undefined) onChange(tabs[index]!.value);
    }
  };

  return (
    <div className="ui-tabs" data-secondary={secondary || undefined} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="ui-focusable"
          id={`${groupId}-tab-${tab.value}`}
          aria-controls={`${groupId}-panel-${tab.value}`}
          aria-selected={tab.value === value}
          aria-disabled={tab.disabledReason !== undefined || undefined}
          tabIndex={index === focusIndex ? 0 : -1}
          title={tab.disabledReason}
          ref={(element) => { refs.current[index] = element; }}
          onFocus={() => setFocusIndex(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onClick={() => {
            if (tab.disabledReason === undefined) onChange(tab.value);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<Value extends string>(props: TabsProps<Value>) {
  return <TabsBase {...props} secondary={false} />;
}

export function SecondaryTabs<Value extends string>(
  props: SecondaryTabsProps<Value>,
) {
  return <TabsBase {...props} secondary />;
}

export type TabPanelProps<Value extends string> = {
  readonly groupId: string;
  readonly value: Value;
  readonly active: boolean;
  readonly children: ReactNode;
  readonly className?: string;
};

export function TabPanel<Value extends string>({
  groupId,
  value,
  active,
  children,
  className,
}: TabPanelProps<Value>) {
  return (
    <section
      id={`${groupId}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${groupId}-tab-${value}`}
      hidden={!active}
      className={["ui-focusable", className].filter(Boolean).join(" ")}
      tabIndex={0}
    >
      {children}
    </section>
  );
}
