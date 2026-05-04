"use client";

import { Component, type ReactNode } from "react";

interface Props {
  /** Optional label so logs and the fallback UI can identify the section. */
  section?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Section-scoped error boundary. A render-time failure in one panel
 * (bad data shape, third-party component crash, etc.) is contained
 * locally — the rest of the dashboard keeps working. Console-logs the
 * stack so it shows up in Vercel function logs / browser dev tools.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error(
      `[ErrorBoundary] section="${this.props.section ?? 'unknown'}"`,
      error,
      info.componentStack
    );
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="rounded-md border border-accent-amber/40 bg-accent-amber/[0.08] px-4 py-3 font-mono text-[12px] text-accent-amber">
            <div className="font-semibold uppercase tracking-terminal">
              Section unavailable
            </div>
            <div className="mt-1 text-accent-amber/80">
              {this.props.section
                ? `"${this.props.section}" failed to render.`
                : 'A section of the dashboard failed to render.'}{' '}
              The rest of the page is unaffected.
            </div>
            <div className="mt-1 text-text-muted">
              {String(this.state.error.message ?? this.state.error).slice(0, 200)}
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
