import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../api/services.ts";

export default function Login() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"admin" | "distribuidor" | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    const token = localStorage.getItem("token");

    if (user && token) {
      // Redirect based on role
      if (user.role === "distribuidor") {
        navigate("/distributor/dashboard", { replace: true });
      } else if (user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authService.login(formData.email, formData.password);
      
      // Verificar que el tipo de usuario coincida con la selección
      if (userType && response.role !== userType) {
        setError(`Esta cuenta no es de tipo ${userType === "admin" ? "Administrador" : "Distribuidor"}`);
        authService.logout();
        setLoading(false);
        return;
      }
      
      // Redirect based on user role
      if (response.role === "distribuidor") {
        navigate("/distributor/dashboard");
      } else if (response.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al iniciar sesión";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl sm:text-4xl md:text-5xl font-bold text-transparent">
            ESSENCE
          </h1>
          <p className="text-base sm:text-lg text-gray-400">Panel de Administración</p>
        </div>

        {/* User Type Selection */}
        {!userType ? (
          <div className="rounded-xl sm:rounded-2xl border border-gray-700 bg-gray-800/50 p-6 sm:p-8 shadow-2xl backdrop-blur-lg">
            <h2 className="mb-4 sm:mb-6 text-center text-xl sm:text-2xl font-bold text-white">
              Selecciona tu tipo de cuenta
            </h2>
            
            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={() => setUserType("admin")}
                className="w-full rounded-lg border-2 border-purple-600 bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6 text-left transition hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                    <svg className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white">Administrador</h3>
                    <p className="text-xs sm:text-sm text-gray-300">Acceso completo al sistema</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setUserType("distribuidor")}
                className="w-full rounded-lg border-2 border-blue-600 bg-gradient-to-r from-blue-600 to-cyan-600 p-4 sm:p-6 text-left transition hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                    <svg className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white">Distribuidor</h3>
                    <p className="text-xs sm:text-sm text-gray-300">Gestión de ventas y productos</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Login Card */}
            <div className="rounded-xl sm:rounded-2xl border border-gray-700 bg-gray-800/50 p-6 sm:p-8 shadow-2xl backdrop-blur-lg">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {userType === "admin" ? "Admin" : "Distribuidor"}
                </h2>
                <button
                  onClick={() => {
                    setUserType(null);
                    setError("");
                    setFormData({ email: "", password: "" });
                  }}
                  className="text-xs sm:text-sm text-gray-400 hover:text-white transition"
                >
                  ← Cambiar
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-3 sm:p-4 text-xs sm:text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Email */}
                <div>
                  <label className="mb-2 block text-xs sm:text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    inputMode="email"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-gray-500 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="tu@email.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="mb-2 block text-xs sm:text-sm font-medium text-gray-300">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-gray-500 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="••••••••"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full rounded-lg py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${
                    userType === "admin"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:ring-purple-500"
                      : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 focus:ring-blue-500"
                  }`}
                >
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </button>
              </form>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500">
          © 2025 Essence. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
