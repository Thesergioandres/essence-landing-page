import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../../utils/cn";

interface LoadingSpinnerProps extends ComponentPropsWithoutRef<"div"> {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  message?: string;
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-3",
  lg: "h-12 w-12 border-4",
  xl: "h-16 w-16 border-4",
};

export default function LoadingSpinner({
  size = "md",
  className,
  message,
  ...props
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" {...props}>
      <div
        className={cn(
          "animate-spin rounded-full border-purple-500 border-t-transparent",
          sizeClasses[size],
          className
        )}
      />
      {message && (
        <p className="animate-pulse text-sm font-medium text-gray-400">
          {message}
        </p>
      )}
    </div>
  );
}
