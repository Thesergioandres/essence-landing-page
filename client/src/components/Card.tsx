import React from "react";
import { cn } from "../utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hover = false,
}) => {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-800 bg-gray-900/60",
        hover && "transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)}>
      {children}
    </div>
  );
};

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className,
}) => {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
};

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)}>
      {children}
    </div>
  );
};
