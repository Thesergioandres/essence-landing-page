import { Link } from "react-router-dom";
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";

export default function UserSettings() {
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
              to="/admin/distributors"
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-4 text-left text-white transition hover:border-blue-500 hover:bg-blue-500/20"
            >
              <h3 className="text-lg font-semibold">Distribuidores</h3>
              <p className="mt-1 text-sm text-gray-200">
                Crea, edita y gestiona distribuidores.
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
      </main>
      <Footer />
    </div>
  );
}
