import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`ErrorBoundary: ${error.message}`, {
      component: "ErrorBoundary",
      errorName: error.name,
      stack: error.stack,
      componentStack: info?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
          <div className="max-w-md space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-xl shadow-black/30">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-200/80">
              Algo salió mal
            </p>
            <p className="text-lg font-bold">Se rompió la UI</p>
            <p className="text-sm text-gray-300">
              {this.state.message ||
                "Ocurrió un error inesperado. Reintenta o recarga la página."}
            </p>
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() =>
                  this.setState({ hasError: false, message: undefined })
                }
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
              >
                Volver a intentar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg border border-purple-500/40 bg-purple-500/20 px-4 py-2 font-semibold text-purple-50 transition hover:border-purple-300/60 hover:bg-purple-500/30"
              >
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
