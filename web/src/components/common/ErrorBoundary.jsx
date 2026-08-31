"use client";

import { Component } from "react";
import "@/styles/components/error-boundary.css";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[app crashed]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash-card">
          <span className="crash-mark">💥</span>
          <h1>Something broke while rendering</h1>
          <p className="muted">
            The page failed to load. The full stack trace is in your browser console.
          </p>
          <pre className="crash-trace">{String(this.state.error?.message || this.state.error)}</pre>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
