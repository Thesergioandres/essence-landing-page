import { useEffect, useState } from 'react';

interface LoadingProgressProps {
  message?: string;
  duration?: number; // duración en ms para simular carga
}

export default function LoadingProgress({ 
  message = 'Cargando...', 
  duration = 2000 
}: LoadingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = 50; // actualizar cada 50ms
    const steps = duration / interval;
    const increment = 100 / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= 100) {
        setProgress(100);
        clearInterval(timer);
      } else {
        // Agregar algo de aleatoriedad para que se vea más natural
        const randomness = Math.random() * 2;
        setProgress(Math.min(current + randomness, 99));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [duration]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900">
      <div className="w-full max-w-md px-6">
        {/* Logo animado */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/20"></div>
            <div className="relative rounded-full bg-gradient-to-br from-purple-600 to-pink-600 p-6">
              <svg 
                className="h-12 w-12 text-white animate-pulse" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z" 
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Mensaje */}
        <h2 className="mb-6 text-center text-2xl font-bold text-white">
          {message}
        </h2>

        {/* Barra de progreso */}
        <div className="mb-4">
          <div className="relative h-3 overflow-hidden rounded-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-[length:200%_100%] animate-gradient transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* Efecto de brillo */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Porcentaje */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Progreso</span>
          <span className="font-mono text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Puntos animados */}
        <div className="mt-8 flex justify-center gap-2">
          <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-pink-500 [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500"></div>
        </div>
      </div>
    </div>
  );
}
