import React from "react";
import { cn } from "../utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const buttonVariants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  outline:
    "border border-gray-700 bg-transparent text-gray-100 hover:bg-white/5 focus:ring-blue-500",
  ghost: "text-gray-200 hover:bg-white/5 focus:ring-gray-500",
};

const buttonSizes = {
  sm: "px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm min-h-[44px]",
  md: "px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base min-h-[48px]",
  lg: "px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg min-h-[52px]",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
