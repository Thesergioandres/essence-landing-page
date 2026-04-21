import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlanLimitModal } from "../../../shared/components/ui";
import { branchService } from "../../branches/services";
import type {
  Branch,
  BusinessPlanSnapshot,
} from "../../business/types/business.types";
import { globalSettingsService } from "../../common/services";
import { employeeService } from "../../employees/services";

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: string;
  allowedBranches: string[];
}

export default function AddEmployee() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    allowedBranches: [],
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [planSnapshot, setPlanSnapshot] = useState<BusinessPlanSnapshot | null>(
    null
  );
  const [showLimitModal, setShowLimitModal] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      globalSettingsService.getBusinessLimits(),
      branchService.list(),
    ]).then(results => {
      const limitsResult = results[0];
      if (limitsResult.status === "fulfilled") {
        setPlanSnapshot(limitsResult.value);
      }

      const branchesResult = results[1];
      if (branchesResult.status === "fulfilled") {
        setBranches(branchesResult.value || []);
      }
    });
  }, []);

  const toggleBranch = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      allowedBranches: prev.allowedBranches.includes(branchId)
        ? prev.allowedBranches.filter(id => id !== branchId)
        : [...prev.allowedBranches, branchId],
    }));
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (planSnapshot && planSnapshot.remaining.employees <= 0) {
      setShowLimitModal(true);
      return;
    }

    setLoading(true);

    try {
      await employeeService.create({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        allowedBranches: formData.allowedBranches,
      });

      navigate("/admin/staff");
    } catch (err) {
      const apiError = err as {
        response?: {
          data?: {
            code?: string;
            message?: string;
            usage?: { employees?: number };
            limits?: { employees?: number };
          };
        };
      };
      if (apiError.response?.data?.code === "PLAN_LIMIT_REACHED") {
        setShowLimitModal(true);
      } else {
        const message =
          apiError?.response?.data?.message || "Error al crear empleado";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-hidden">
      <div>
        <button
          onClick={() => navigate("/admin/staff")}
          className="mb-4 text-sm text-gray-400 hover:text-white"
        >
          ← Volver a empleados
        </button>
        <h1 className="text-4xl font-bold text-white">Nuevo Empleado</h1>
        <p className="mt-2 text-gray-400">
          Completa la información para crear un nuevo empleado
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Información Personal
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Nombre Completo *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="empleado@correo.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Teléfono
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="+1234567890"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Dirección
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Calle, Ciudad, País"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Credenciales de Acceso
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Contraseña *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Confirmar Contraseña *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Acceso por Sedes
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Si no seleccionas ninguna sede, el empleado tendrá acceso a todas.
          </p>

          {branches.length === 0 ? (
            <p className="text-sm text-gray-500">
              No hay sedes registradas todavía.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {branches.map(branch => {
                const checked = formData.allowedBranches.includes(branch._id);
                return (
                  <label
                    key={branch._id}
                    className="flex min-h-11 items-center justify-between rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 text-sm text-gray-200"
                  >
                    <span>{branch.name}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBranch(branch._id)}
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/staff")}
            className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-linear-to-r rounded-lg from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Empleado"}
          </button>
        </div>
      </form>

      <PlanLimitModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title="Límite de empleados alcanzado"
        description="Tu plan actual alcanzó el máximo de empleados permitidos. Actualiza tu plan para seguir creando empleados."
        plan={planSnapshot?.plan}
        currentUsage={planSnapshot?.usage.employees}
        currentLimit={planSnapshot?.limits.employees}
      />
    </div>
  );
}
