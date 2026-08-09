import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// A render-time throw anywhere below unmounts the whole tree and leaves a blank
// white page with nothing but a console message — which reads as "the app is
// broken" rather than "something specific went wrong." This turns that into a
// visible message plus a way out that doesn't cost the user their scenarios.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h1 className="text-base font-semibold text-red-900">
            Something went wrong
          </h1>
          <p className="text-sm text-red-800 mt-1">
            Your saved scenarios are still stored in this browser — reloading
            usually clears this up.
          </p>
          <pre className="mt-3 text-xs text-red-700 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
