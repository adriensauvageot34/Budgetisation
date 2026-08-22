function token<Name extends string>(name: Name): `var(--${Name})` {
  return `var(--${name})`;
}

export const designTokens = {
  typography: {
    family: {
      sans: token("ui-font-family-sans"),
      technical: token("ui-font-family-technical"),
    },
    size: {
      body: token("ui-font-size-body"),
      metadata: token("ui-font-size-metadata"),
      section: token("ui-font-size-section"),
      page: token("ui-font-size-page"),
      metric: token("ui-font-size-metric"),
    },
    weight: {
      regular: token("ui-font-weight-regular"),
      medium: token("ui-font-weight-medium"),
      strong: token("ui-font-weight-strong"),
    },
    lineHeight: {
      body: token("ui-line-height-body"),
      tight: token("ui-line-height-tight"),
    },
  },
  spacing: {
    1: token("ui-space-1"),
    2: token("ui-space-2"),
    3: token("ui-space-3"),
    4: token("ui-space-4"),
    6: token("ui-space-6"),
    8: token("ui-space-8"),
    12: token("ui-space-12"),
    16: token("ui-space-16"),
    page: token("ui-space-page"),
  },
  color: {
    surface: {
      canvas: token("ui-color-surface-canvas"),
      base: token("ui-color-surface-base"),
      subtle: token("ui-color-surface-subtle"),
      raised: token("ui-color-surface-raised"),
      overlay: token("ui-color-surface-overlay"),
    },
    text: {
      primary: token("ui-color-text-primary"),
      secondary: token("ui-color-text-secondary"),
      muted: token("ui-color-text-muted"),
      onAction: token("ui-color-text-on-action"),
    },
    border: {
      subtle: token("ui-color-border-subtle"),
      default: token("ui-color-border-default"),
      strong: token("ui-color-border-strong"),
      focus: token("ui-color-border-focus"),
    },
    action: {
      primary: token("ui-color-action-primary"),
      primaryHover: token("ui-color-action-primary-hover"),
      secondary: token("ui-color-action-secondary"),
      quiet: token("ui-color-action-quiet"),
      destructive: token("ui-color-action-destructive"),
    },
    semantic: {
      error: token("ui-color-semantic-error"),
      errorSoft: token("ui-color-semantic-error-soft"),
      warning: token("ui-color-semantic-warning"),
      warningSoft: token("ui-color-semantic-warning-soft"),
      info: token("ui-color-semantic-info"),
      infoSoft: token("ui-color-semantic-info-soft"),
      success: token("ui-color-semantic-success"),
      successSoft: token("ui-color-semantic-success-soft"),
    },
    chart: {
      series: [
        token("ui-color-chart-series-1"),
        token("ui-color-chart-series-2"),
        token("ui-color-chart-series-3"),
        token("ui-color-chart-series-4"),
        token("ui-color-chart-series-5"),
      ],
      sequential: {
        low: token("ui-color-chart-sequential-low"),
        medium: token("ui-color-chart-sequential-medium"),
        high: token("ui-color-chart-sequential-high"),
      },
      diverging: {
        low: token("ui-color-chart-diverging-low"),
        center: token("ui-color-chart-diverging-center"),
        high: token("ui-color-chart-diverging-high"),
      },
      unknown: token("ui-color-chart-unknown"),
      notApplicable: token("ui-color-chart-not-applicable"),
      insufficient: token("ui-color-chart-insufficient"),
    },
  },
  radius: {
    sm: token("ui-radius-sm"),
    md: token("ui-radius-md"),
    lg: token("ui-radius-lg"),
    overlay: token("ui-radius-overlay"),
    pill: token("ui-radius-pill"),
  },
  border: {
    subtle: token("ui-border-width-subtle"),
    default: token("ui-border-width-default"),
    strong: token("ui-border-width-strong"),
    focus: token("ui-border-width-focus"),
  },
  elevation: {
    surface: token("ui-elevation-surface"),
    raised: token("ui-elevation-raised"),
    overlay: token("ui-elevation-overlay"),
  },
  motion: {
    duration: {
      fast: token("ui-motion-duration-fast"),
      standard: token("ui-motion-duration-standard"),
    },
    easing: token("ui-motion-easing-standard"),
  },
  focus: { ring: token("ui-focus-ring") },
  icon: {
    size: {
      sm: token("ui-icon-size-sm"),
      md: token("ui-icon-size-md"),
      lg: token("ui-icon-size-lg"),
    },
    stroke: token("ui-icon-stroke"),
  },
} as const;

export type DesignTokens = typeof designTokens;
