"use client";

export type TabOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly disabledReason?: string;
};

type TabsBaseProps<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly tabs: readonly TabOption<Value>[];
  readonly onChange: (value: Value) => void;
};

export type TabsProps<Value extends string> = TabsBaseProps<Value>;
export type SecondaryTabsProps<Value extends string> = TabsBaseProps<Value>;

function TabsBase<Value extends string>({
  label,
  value,
  tabs,
  onChange,
  secondary,
}: TabsBaseProps<Value> & { readonly secondary: boolean }) {
  return (
    <div className="ui-tabs" data-secondary={secondary || undefined} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="ui-focusable"
          aria-selected={tab.value === value}
          disabled={tab.disabledReason !== undefined}
          title={tab.disabledReason}
          onClick={() => onChange(tab.value)}
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
