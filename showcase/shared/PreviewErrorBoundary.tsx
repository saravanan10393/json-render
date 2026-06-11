"use client";

/**
 * Shared error boundary for live previews — keeps one broken demo, block, or
 * invalid hand-edit from taking down the whole gallery. Used by both the
 * component and block preview renderers.
 */
import { Component, type ReactNode } from "react";

export class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Preview failed to render: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
