import { useNavigate } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

  return (
    <div className="min-h-screen bg-[#070910] px-4 py-10 text-white sm:px-6 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
        {/* Info column */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <img
              src="/erp-logo.png"
              alt="Essence ERP"
              className="h-14 w-auto sm:h-16"
              loading="lazy"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
                Essence ERP
              </p>
              <h1 className="bg-linear-to-r from-purple-200 to-pink-200 bg-clip-text text-3xl font-extrabold leading-tight text-transparent sm:text-4xl lg:text-5xl">
                Control total de tus operaciones
              </h1>
            </div>
          </div>
        </div>

        {/* Auth column */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-purple-900/40 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
                Acceso
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Inicia sesión
              </h2>
              <p className="mt-1 text-sm text-gray-300">
                Una sola puerta de entrada. Te llevamos al panel correcto según
                tu rol.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <LoginForm onSubmit={login} isLoading={isLoading} />

            <div className="text-center text-sm text-gray-300">
              ¿No tienes cuenta?
              <button
                onClick={() => navigate("/register")}
                className="ml-1 font-semibold text-purple-300 underline-offset-2 hover:underline"
                type="button"
              >
                Regístrate
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-2 text-center text-sm text-gray-400">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Essence. Todos los derechos
              reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
