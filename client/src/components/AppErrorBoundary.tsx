import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
  componentStack?: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: undefined, componentStack: undefined };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error);
    console.error("[AppErrorBoundary] Component stack:", info.componentStack);
    
    this.setState({
      componentStack: info.componentStack || undefined,
    });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
          <div className="max-w-md px-6 py-6 rounded-2xl border border-slate-700 bg-slate-900/80 shadow-lg">
            <h1 className="text-lg font-semibold mb-3 text-red-400">
              Something went wrong loading the app.
            </h1>
            {this.state.message && (
              <p className="text-sm text-slate-300 mb-4 break-words font-mono bg-slate-800 p-3 rounded">
                {this.state.message}
              </p>
            )}
            <p className="text-sm text-slate-400 mb-4">
              This error has been logged. Try refreshing the page. If this keeps happening, 
              please send a screenshot of this message to support.
            </p>
            <button
              onClick={this.handleRefresh}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              data-testid="button-error-refresh"
            >
              Refresh Page
            </button>
            {this.state.componentStack && (
              <details className="mt-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs text-slate-500 overflow-auto max-h-40 bg-slate-800 p-2 rounded">
                  {this.state.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
