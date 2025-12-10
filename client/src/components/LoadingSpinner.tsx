interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  variant?: 'spinner' | 'dots' | 'pulse';
}

export default function LoadingSpinner({ 
  size = 'md', 
  message,
  variant = 'spinner'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4'
  };

  if (variant === 'dots') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          <div className={`${dotSizes[size]} animate-bounce rounded-full bg-purple-500 [animation-delay:-0.3s]`}></div>
          <div className={`${dotSizes[size]} animate-bounce rounded-full bg-pink-500 [animation-delay:-0.15s]`}></div>
          <div className={`${dotSizes[size]} animate-bounce rounded-full bg-purple-500`}></div>
        </div>
        {message && <p className="text-gray-400 text-sm">{message}</p>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-600 to-pink-600 animate-pulse`}></div>
          <div className={`absolute inset-0 ${sizeClasses[size]} animate-ping rounded-full bg-purple-500/30`}></div>
        </div>
        {message && <p className="text-gray-400 text-sm">{message}</p>}
      </div>
    );
  }

  // Variant: spinner (default)
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className={`${sizeClasses[size]} animate-spin rounded-full border-b-4 border-t-4 border-purple-500`}></div>
        <div className={`absolute inset-0 ${sizeClasses[size]} animate-ping rounded-full border-4 border-purple-500/20`}></div>
      </div>
      {message && <p className="text-gray-400 text-sm animate-pulse">{message}</p>}
    </div>
  );
}
