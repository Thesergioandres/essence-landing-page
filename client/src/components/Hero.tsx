import { useSmartLoginEntry } from "../features/auth/hooks/useSmartLoginEntry";

export default function Hero() {
  const { enter, loading } = useSmartLoginEntry();

  const scrollToModules = () => {
    document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-[#0b0c14] px-4 py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-10 -top-10 h-60 w-60 rounded-full bg-purple-700/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-pink-600/15 blur-3xl" />
        <div className="bg-linear-to-r absolute inset-x-0 top-10 h-px from-transparent via-purple-500/40 to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-6 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-purple-100">
            ERP modular • Multi-empresa
          </div>

          <div className="space-y-4">
            <h1 className="bg-linear-to-r from-purple-200 via-white to-purple-300 bg-clip-text text-4xl font-extrabold leading-[1.05] text-transparent sm:text-5xl md:text-6xl">
              Un ERP que opera por negocios.
            </h1>
            <p className="max-w-2xl text-base text-gray-300 sm:text-lg">
              Centraliza inventario, catálogos, comisiones y analítica en un
              mismo panel. Activa módulos por negocio y controla todo sin perder
              velocidad.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <button
              onClick={scrollToModules}
              className="bg-linear-to-r group relative flex-1 overflow-hidden rounded-xl from-purple-600 to-fuchsia-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-purple-700/30 transition hover:shadow-purple-500/40 sm:flex-none sm:px-6"
            >
              <span className="relative z-10">Ver módulos</span>
              <span className="absolute inset-0 translate-y-full bg-white/10 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100" />
            </button>
            <button
              onClick={() => {
                void enter();
              }}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-purple-400/40 bg-white/5 px-5 py-3.5 text-base font-semibold text-purple-100 transition hover:border-purple-300/70 hover:text-white sm:flex-none sm:px-6"
            >
              Entrar al panel
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["Multi-empresa", "Roles y permisos", "KPIs en vivo"].map(
              label => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-gray-200"
                >
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        <div className="relative w-full max-w-xl self-center lg:self-end">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-purple-900/30 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gray-400">
                  Operación
                </p>
                <p className="text-lg font-semibold text-white">
                  Módulos activos
                </p>
              </div>
              <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-200">
                Uptime 99.9%
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {["Inventario en vivo", "Catálogo distribuido"].map(title => (
                <div
                  key={title}
                  className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm text-gray-100 shadow-inner shadow-purple-900/30"
                >
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-white">{title}</p>
                    <span className="rounded-full bg-purple-500/20 px-2 py-1 text-[10px] font-bold text-purple-100">
                      Activo
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Controla stock, permisos y reglas por negocio sin romper la
                    operación diaria.
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm text-gray-200">
              <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <p className="text-xl font-bold text-white">24</p>
                <p className="text-[11px] text-gray-400">Negocios activos</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <p className="text-xl font-bold text-white">+180</p>
                <p className="text-[11px] text-gray-400">Jobs diarios</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <p className="text-xl font-bold text-white">99.9%</p>
                <p className="text-[11px] text-gray-400">Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
