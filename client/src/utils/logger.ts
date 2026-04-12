/**
 * Utilidad de logging estandarizado para el frontend
 * Cumple con el requerimiento de logs [UI ERROR], [UI WARN], [UI INFO]
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  module?: string;
  component?: string;
  action?: string;
  userId?: string;
  businessId?: string;
  requestId?: string;
  [key: string]: unknown;
}

const formatMessage = (prefix: string, message: string): string => {
  return `${prefix} ${message}`;
};

const createLogPayload = (context?: LogContext) => {
  const businessId = localStorage.getItem("businessId");
  const userStr = localStorage.getItem("user");
  let userId: string | undefined;

  try {
    const user = userStr ? JSON.parse(userStr) : null;
    userId = user?._id;
  } catch {
    // Ignorar errores de parsing
  }

  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    businessId: context?.businessId || businessId || undefined,
    userId: context?.userId || userId || undefined,
    ...context,
  };
};

const log = (level: LogLevel, message: string, context?: LogContext) => {
  const payload = createLogPayload(context);

  switch (level) {
    case "info":
      console.warn("[Essence Debug]", formatMessage("[UI INFO]", message), payload);
      break;
    case "warn":
      console.warn(formatMessage("[UI WARN]", message), payload);
      break;
    case "error":
      console.error(formatMessage("[UI ERROR]", message), payload);
      break;
  }
};

export const logUI = {
  /**
   * Log informativo para eventos normales
   * @example logUI.info("Datos cargados", { module: "credits", count: 10 })
   */
  info: (message: string, context?: LogContext) => {
    log("info", message, context);
  },

  /**
   * Log de advertencia para situaciones anÃ³malas pero no crÃ­ticas
   * @example logUI.warn("Sin conexiÃ³n, usando cachÃ©", { module: "api" })
   */
  warn: (message: string, context?: LogContext) => {
    log("warn", message, context);
  },

  /**
   * Log de error para fallos crÃ­ticos
   * @example logUI.error("Error al cargar datos", { module: "credits", error: err })
   */
  error: (message: string, context?: LogContext & { error?: unknown }) => {
    const errorContext = { ...context };

    if (context?.error instanceof Error) {
      errorContext.errorMessage = context.error.message;
      errorContext.stack = context.error.stack;
    } else if (context?.error) {
      errorContext.errorMessage = String(context.error);
    }

    log("error", message, errorContext);
  },
};

/**
 * HOC para capturar errores en componentes React
 */
export const logComponentError = (
  componentName: string,
  error: Error,
  errorInfo?: { componentStack?: string }
) => {
  logUI.error(`Error en componente: ${componentName}`, {
    component: componentName,
    errorMessage: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
  });
};

export default logUI;

