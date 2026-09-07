"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export class GlobalModuleBoundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    window.dispatchEvent(new CustomEvent("global_module_render_error", { detail: { message: error.message, componentStack: info.componentStack } }));
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <section role="alert"><strong>Ce module n’a pas pu s’afficher.</strong><p>Les autres analyses restent disponibles.</p></section>;
    }
    return this.props.children;
  }
}
