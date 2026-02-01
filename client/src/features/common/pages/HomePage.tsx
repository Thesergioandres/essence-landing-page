import Footer from "../../../components/Footer";
import Hero from "../../../components/Hero";
import Navbar from "../../../components/Navbar";

const modules = [
  {
    title: "Inventario centralizado",
    description:
      "Stock en vivo por sucursal y canal, con catálogo unificado y alertas de reposición.",
    highlights: ["Multi-sucursal", "SKUs únicos", "Alertas automáticas"],
  },
  {
    title: "Ventas omnicanal",
    description:
      "Opera tiendas, mayoristas y reparto con reglas distintas y conciliación en un solo tablero.",
    highlights: ["Canales B2B/B2C", "Listas de precio", "Checkout flexible"],
  },
  {
    title: "Catálogo distribuido",
    description:
      "Comparte catálogos, controla comisiones y permisos por negocio o distribuidor.",
    highlights: ["Roles y scopes", "Comisiones", "Visibilidad controlada"],
  },
  {
    title: "Finanzas y comisiones",
    description:
      "Cierra el mes con flujos claros: pagos, comisiones y costos en un solo lugar.",
    highlights: ["Cortes automáticos", "Margen por SKU", "Pagos conciliados"],
  },
  {
    title: "Analítica en tiempo real",
    description:
      "Ranking de ventas, cohorts y proyección de demanda por unidad de negocio.",
    highlights: ["KPIs vivos", "Alertas", "Exportables"],
  },
  {
    title: "Automatizaciones",
    description:
      "Jobs programados para precios, stock y catálogos sin depender del equipo.",
    highlights: ["Tareas nocturnas", "Reglas por canal", "APIs abiertas"],
  },
];

const operatingModel = [
  {
    title: "Multi-empresa sin fricción",
    description:
      "Define módulos por negocio: habilita solo lo que cada operación necesita sin duplicar datos.",
  },
  {
    title: "Gobernanza y control",
    description:
      "Roles, permisos y bitácora por acción. Audita cambios en precios, stock y comisiones.",
  },
  {
    title: "Infra lista para producción",
    description:
      "CORS, workers y jobs ya corriendo; despliegues con Docker y Nixpacks listos para cloud.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080910]">
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Módulos ERP */}
      <section
        id="modulos"
        className="mx-auto max-w-7xl px-3 py-12 sm:px-5 sm:py-14 md:px-8 md:py-16"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-200">
              ERP modular
            </p>
            <h2 className="bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
              Un tablero para cada negocio
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-400 sm:text-base">
              Activa solo los módulos que necesitas. Gestiona inventario,
              catálogos distribuidos, comisiones y analítica en un solo lugar,
              sin perder control.
            </p>
          </div>
          <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-100">
            Multi-empresa listo para producción
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(mod => (
            <div
              key={mod.title}
              className="group flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-purple-900/20 transition hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-purple-800/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-purple-200">
                    Módulo
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    {mod.title}
                  </h3>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-gray-200 group-hover:border-purple-300/50">
                  Actívalo
                </span>
              </div>
              <p className="text-sm text-gray-300">{mod.description}</p>
              <div className="flex flex-wrap gap-2">
                {mod.highlights.map(item => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-gray-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modelo operativo */}
      <section className="border-t border-white/5 bg-[#0c0d15] py-12 sm:py-14 md:py-16">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 md:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-200">
                Operación
              </p>
              <h2 className="bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                Diseñado para multi-negocio
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-gray-400 sm:text-base">
                Control granular sin perder velocidad: permisos, auditoría y
                despliegues listos para equipos que crecen.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-gray-200">
              Secure by default
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {operatingModel.map(item => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/5 bg-white/5 p-5 text-left shadow-sm shadow-purple-900/20"
              >
                <h3 className="text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experience strip */}
      <section className="border-t border-white/5 bg-gradient-to-r from-purple-900/30 via-transparent to-fuchsia-900/30 py-10 sm:py-12 md:py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:px-8">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-100">
              Experiencia Essence
            </p>
            <h3 className="text-2xl font-bold text-white sm:text-3xl">
              Entrega rápida, cambios seguros
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-gray-300 sm:text-base">
              Jobs nocturnos, controles de CORS y despliegues con Docker listos.
              Ajusta módulos por negocio sin romper producción.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3 sm:gap-4">
            {[
              "Configura módulos",
              "Comparte catálogo",
              "Escala operaciones",
            ].map(item => (
              <div
                key={item}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-gray-100 shadow-sm shadow-purple-900/30"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
