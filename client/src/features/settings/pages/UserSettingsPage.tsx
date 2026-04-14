import { Link } from "react-router-dom";
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";
import {
  MOTION_MODE_OPTIONS,
  useMotionProfile,
} from "../../../shared/config/motion.config";

export default function UserSettings() {
  const { mode, motionProfile, setMotionMode } = useMotionProfile();

  return (
    <div className="bg-linear-to-br min-h-screen from-gray-900 via-purple-900/20 to-gray-900">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Configurar usuarios
          </h1>
          <p className="mt-2 text-sm text-gray-400 sm:text-base">
            Administra roles y accesos de tu equipo.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/60 p-6 shadow-xl backdrop-blur">
          <p className="text-sm text-gray-300">
            Usa las siguientes secciones para gestionar tu equipo:
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to="/admin/employees"
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-4 text-left text-white transition hover:border-blue-500 hover:bg-blue-500/20"
            >
              <h3 className="text-lg font-semibold">Employees</h3>
              <p className="mt-1 text-sm text-gray-200">
                Crea, edita y gestiona employees.
              </p>
            </Link>
            <Link
              to="/admin/users"
              className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-4 text-left text-white transition hover:border-purple-500 hover:bg-purple-500/20"
            >
              <h3 className="text-lg font-semibold">Usuarios (próximamente)</h3>
              <p className="mt-1 text-sm text-gray-200">
                Gestión ampliada de usuarios y roles.
              </p>
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Nota: la página de Usuarios es un placeholder hasta habilitar la
            gestión completa.
          </p>
        </div>

        <div className="bg-cyan-500/8 mt-6 space-y-4 rounded-xl border border-cyan-500/30 p-6 shadow-xl backdrop-blur">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Intensidad de Animaciones
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              Personaliza la energía visual de toda la aplicación.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MOTION_MODE_OPTIONS.map(option => {
              const isActive = mode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMotionMode(option.value)}
                  aria-pressed={isActive}
                  className={`min-h-11 rounded-xl border px-4 py-4 text-left transition-all duration-300 ${
                    isActive
                      ? "bg-cyan-500/18 border-cyan-400/70 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                      : "border-white/12 bg-white/5 text-gray-200 hover:border-cyan-400/35 hover:bg-cyan-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold">
                      {option.label}
                    </span>
                    {isActive && (
                      <span className="rounded-full border border-cyan-300/50 bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-300">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300">
            <p>
              Ruta: {motionProfile.routeDuration.toFixed(2)}s | Vista:{" "}
              {motionProfile.viewDuration.toFixed(2)}s
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
