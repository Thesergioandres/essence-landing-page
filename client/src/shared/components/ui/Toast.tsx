import { useEffect, useState } from "react";
import {
  subscribeToToasts,
  toast,
  type Toast,
  type ToastType,
} from "../../../utils/toast";

interface ToastContainerProps {
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center";
}

const typeStyles: Record<
  ToastType,
  { bg: string; icon: string; iconBg: string }
> = {
  success: {
    bg: "bg-green-900/90 border-green-500/50",
    icon: "✓",
    iconBg: "bg-green-500",
  },
  error: {
    bg: "bg-red-900/90 border-red-500/50",
    icon: "✕",
    iconBg: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-900/90 border-amber-500/50",
    icon: "!",
    iconBg: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-900/90 border-blue-500/50",
    icon: "i",
    iconBg: "bg-blue-500",
  },
};

const positionStyles = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
};

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const style = typeStyles[t.type];

  return (
    <div
      className={`
        animate-slide-in-right flex items-center gap-3 rounded-lg border px-4 py-3
        shadow-lg backdrop-blur-sm
        ${style.bg}
      `}
      role="alert"
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${style.iconBg}`}
      >
        {style.icon}
      </span>
      <p className="flex-1 text-sm text-white">{t.message}</p>
      <button
        onClick={onDismiss}
        className="p-1 text-white/60 transition-colors hover:text-white"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Contenedor de toasts - agregar una vez en el layout principal
 */
export function ToastContainer({
  position = "top-right",
}: ToastContainerProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts(setToasts);
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-50 flex w-full max-w-sm flex-col gap-2 ${positionStyles[position]}`}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => toast.dismiss(t.id)} />
      ))}
    </div>
  );
}

export { toast };
export default ToastContainer;
