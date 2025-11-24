import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 px-6 py-20 lg:px-8 lg:py-32">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-pink-600/20 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="text-center">
          {/* Logo/Brand */}
          <h1 className="mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-6xl font-bold text-transparent md:text-8xl">
            ESSENCE
          </h1>

          {/* Slogan */}
          <p className="mb-4 text-2xl font-semibold text-white md:text-3xl">
            Tu esencia, tu estilo
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-300 md:text-xl">
            Descubre nuestra colección exclusiva de vapes, accesorios y más.
            Calidad premium para los que buscan algo diferente.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => navigate("/productos")}
              className="group relative overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-purple-500/50"
            >
              <span className="relative z-10">Ver Productos</span>
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-purple-700 to-pink-700 opacity-0 transition-opacity group-hover:opacity-100"></div>
            </button>

            <button
              onClick={() => navigate("/productos")}
              className="rounded-full border-2 border-purple-500 px-8 py-4 text-lg font-semibold text-purple-400 transition-all hover:bg-purple-500/10"
            >
              Explorar Categorías
            </button>
          </div>

          {/* Features */}
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg transition hover:border-purple-500">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-purple-600/20 p-4">
                  <svg
                    className="h-8 w-8 text-purple-400"
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
              <h3 className="mb-2 text-lg font-semibold text-white">
                Calidad Premium
              </h3>
              <p className="text-gray-400">
                Productos seleccionados con los más altos estándares de calidad
              </p>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg transition hover:border-pink-500">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-pink-600/20 p-4">
                  <svg
                    className="h-8 w-8 text-pink-400"
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
              <h3 className="mb-2 text-lg font-semibold text-white">
                Envío Rápido
              </h3>
              <p className="text-gray-400">
                Entrega ágil para que disfrutes tu compra cuanto antes
              </p>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg transition hover:border-purple-500">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-purple-600/20 p-4">
                  <svg
                    className="h-8 w-8 text-purple-400"
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
              <h3 className="mb-2 text-lg font-semibold text-white">
                Variedad Única
              </h3>
              <p className="text-gray-400">
                Amplio catálogo para todos los gustos y preferencias
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
