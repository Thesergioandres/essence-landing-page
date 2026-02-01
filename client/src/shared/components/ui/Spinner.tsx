interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "purple" | "white" | "gray" | "green" | "red";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const colorClasses = {
  purple: "border-purple-500/30 border-t-purple-500",
  white: "border-white/30 border-t-white",
  gray: "border-gray-500/30 border-t-gray-500",
  green: "border-green-500/30 border-t-green-500",
  red: "border-red-500/30 border-t-red-500",
};

/**
 * Spinner de carga reutilizable
 */
export default function Spinner({
  size = "md",
  color = "purple",
  className = "",
}: SpinnerProps) {
  return (
    <div
      className={`
        animate-spin rounded-full border-2
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${className}
      `}
      role="status"
      aria-label="Cargando"
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
