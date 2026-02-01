import Spinner from "./Spinner";

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
  transparent?: boolean;
}

/**
 * Overlay de carga para secciones o pantalla completa
 */
export default function LoadingOverlay({
  message = "Cargando...",
  fullScreen = false,
  transparent = false,
}: LoadingOverlayProps) {
  const containerClasses = fullScreen
    ? "fixed inset-0 z-50"
    : "absolute inset-0 z-10";

  const bgClasses = transparent
    ? "bg-gray-950/50 backdrop-blur-sm"
    : "bg-gray-950";

  return (
    <div
      className={`${containerClasses} ${bgClasses} flex flex-col items-center justify-center`}
    >
      <Spinner size="xl" color="purple" />
      {message && (
        <p className="mt-4 animate-pulse text-sm text-gray-400">{message}</p>
      )}
    </div>
  );
}
