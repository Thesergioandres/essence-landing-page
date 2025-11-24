import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-32">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 sm:-right-40 -top-20 sm:-top-40 h-60 w-60 sm:h-80 sm:w-80 rounded-full bg-purple-600/20 blur-3xl"></div>
        <div className="absolute -bottom-20 sm:-bottom-40 -left-20 sm:-left-40 h-60 w-60 sm:h-80 sm:w-80 rounded-full bg-pink-600/20 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="text-center">
          {/* Logo/Brand */}
          <h1 className="mb-4 sm:mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-transparent leading-tight">
            ESSENCE
          </h1>

          {/* Slogan */}
          <p className="mb-3 sm:mb-4 text-xl sm:text-2xl md:text-3xl font-semibold text-white">
            Tu esencia, tu estilo
          </p>
          <p className="mx-auto mb-8 sm:mb-10 max-w-2xl text-base sm:text-lg md:text-xl text-gray-300 px-4">
            Descubre nuestra colección exclusiva de vapes, accesorios y más.
            Calidad premium para los que buscan algo diferente.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row px-4">
            <button
              onClick={() => navigate("/productos")}
              className="group relative w-full sm:w-auto overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg transition-all hover:shadow-purple-500/50"
            >
              <span className="relative z-10">Ver Productos</span>
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-purple-700 to-pink-700 opacity-0 transition-opacity group-hover:opacity-100"></div>
            </button>

            <button
              onClick={() => navigate("/productos")}
              className="w-full sm:w-auto rounded-full border-2 border-purple-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-purple-400 transition-all hover:bg-purple-500/10"
            >
              Explorar Categorías
            </button>
          </div>

          {/* Features */}
          <div className="mt-12 sm:mt-16 grid gap-6 sm:gap-8 md:grid-cols-3 px-4">
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 sm:p-6 backdrop-blur-lg transition hover:border-purple-500">
              <div className="mb-3 sm:mb-4 flex justify-center">
                <div className="rounded-full bg-purple-600/20 p-3 sm:p-4">
                  <svg
                    className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-base sm:text-lg font-semibold text-white">
                Calidad Premium
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                Productos seleccionados con los más altos estándares de calidad
              </p>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 sm:p-6 backdrop-blur-lg transition hover:border-pink-500">
              <div className="mb-3 sm:mb-4 flex justify-center">
                <div className="rounded-full bg-pink-600/20 p-3 sm:p-4">
                  <svg
                    className="h-6 w-6 sm:h-8 sm:w-8 text-pink-400"
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
              <h3 className="mb-2 text-base sm:text-lg font-semibold text-white">
                Envío Rápido
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                Entrega ágil para que disfrutes tu compra cuanto antes
              </p>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 sm:p-6 backdrop-blur-lg transition hover:border-purple-500">
              <div className="mb-3 sm:mb-4 flex justify-center">
                <div className="rounded-full bg-purple-600/20 p-3 sm:p-4">
                  <svg
                    className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-base sm:text-lg font-semibold text-white">
                Variedad Única
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                Amplio catálogo para todos los gustos y preferencias
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
