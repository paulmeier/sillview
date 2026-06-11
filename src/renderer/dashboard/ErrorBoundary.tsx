import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Isolates a widget so one crash can't take down the whole dashboard. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Widget crashed:', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
          <span className="text-sm font-medium text-rose-300/90">Widget error</span>
          <span className="text-xs text-slate-500">{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
