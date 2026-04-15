import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { Button, Input } from "../../../shared/components/ui";
import { globalSettingsService } from "../../common/services";
import { authService } from "../services";

type PlanOption = {
  id: "starter" | "pro" | "enterprise";
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  limits: { branches: number; employees: number };
};

const fallbackPlans: PlanOption[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Para negocios en etapa inicial",
    monthlyPrice: 19,
    yearlyPrice: 190,
    currency: "USD",
    limits: { branches: 1, employees: 2 },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Para equipos que escalan ventas",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "USD",
    limits: { branches: 3, employees: 10 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Para operaciones multi-sede avanzadas",
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: "USD",
    limits: { branches: 10, employees: 50 },
  },
];

const WHATSAPP_OWNER_PHONE = "573185753007";
const REGISTER_STEP_STORAGE_KEY = "pending_register_user";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registeredUser, setRegisteredUser] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>(fallbackPlans);
  const [planAction, setPlanAction] = useState<PlanOption["id"] | null>(null);
  const brandLogo = useBrandLogo();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const step = params.get("step");
    if (step !== "plan" || registeredUser) return;

    const raw = sessionStorage.getItem(REGISTER_STEP_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { name?: string; email?: string };
      if (parsed?.name && parsed?.email) {
        setRegisteredUser({ name: parsed.name, email: parsed.email });
        setSuccess(
          "✅ Registro completado. Ahora elige tu plan para continuar."
        );
      }
    } catch {
      sessionStorage.removeItem(REGISTER_STEP_STORAGE_KEY);
    }
  }, [location.search, registeredUser]);

  useEffect(() => {
    globalSettingsService
      .getPublicSettings()
      .then(settings => {
        setPlans([
          settings.plans.starter,
          settings.plans.pro,
          settings.plans.enterprise,
        ] as PlanOption[]);
      })
      .catch(() => undefined);
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();
    const digitsInPhone = trimmedPhone.replace(/\D/g, "");
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;

    if (!trimmedName || /\d/.test(trimmedName)) {
      setError("El nombre no debe contener números");
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setError("Ingresa un correo electrónico válido");
      return;
    }

    if (/[a-zA-Z]/.test(trimmedPhone) || digitsInPhone.length < 7) {
      setError("Ingresa un teléfono válido (solo números y mínimo 7 dígitos)");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        password: formData.password,
        phone: trimmedPhone,
        address: formData.address.trim(),
        logo: null,
      };

      const authData = await authService.register(payload);
      const pendingUser = { name: trimmedName, email: trimmedEmail };

      if (authData.role === "god") {
        setSuccess("✅ Registro completado en modo Administrador Maestro.");
        navigate("/onboarding", { replace: true });
      } else {
        setRegisteredUser(pendingUser);
        sessionStorage.setItem(
          REGISTER_STEP_STORAGE_KEY,
          JSON.stringify(pendingUser)
        );
        setSuccess(
          "✅ Registro completado. Ahora elige tu plan para continuar."
        );
        navigate("/register?step=plan", { replace: true });
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo completar el registro";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = async (plan: PlanOption) => {
    if (!registeredUser) return;

    setError("");
    setPlanAction(plan.id);
    try {
      await authService.selectPlan(plan.id);

      const text = [
        "Hola, acabo de registrarme en Essence ERP.",
        `Nombre: ${registeredUser.name}`,
        `Email: ${registeredUser.email}`,
        `Plan elegido: ${plan.name}`,
        `Valor mensual: ${plan.currency} ${plan.monthlyPrice}`,
        "Comparto comprobante de consignación para activar 30 días.",
      ].join("\n");

      const whatsappUrl = `https://wa.me/${WHATSAPP_OWNER_PHONE}?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      authService.logout();
      sessionStorage.removeItem(REGISTER_STEP_STORAGE_KEY);
      navigate("/account-hold?reason=pending", {
        replace: true,
        state: { reason: "pending" },
      });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo guardar el plan seleccionado";
      setError(message);
    } finally {
      setPlanAction(null);
    }
  };

  return (
    <div className="bg-app-base min-h-screen px-4 py-10 text-white sm:px-6 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="Essence ERP"
              className="h-14 w-auto sm:h-16"
              loading="lazy"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
                Essence ERP
              </p>
              <h1 className="bg-linear-to-r from-purple-200 to-pink-200 bg-clip-text text-3xl font-extrabold leading-tight text-transparent sm:text-4xl lg:text-5xl">
                Crea tu cuenta y elige tu plan
              </h1>
            </div>
          </div>

          <p className="max-w-2xl text-base text-gray-300 sm:text-lg">
            Registro rápido, selección de plan y activación manual por WhatsApp
            después de validar tu consignación.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-purple-900/40 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
              Registro
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {registeredUser ? "Elige tu plan" : "Crear cuenta"}
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              {registeredUser
                ? "Te enviaremos al chat de WhatsApp para validar pago y activar 30 días."
                : "Te tomará menos de un minuto."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-200">
              {success}
            </div>
          )}

          {!registeredUser ? (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <Input
                label="Nombre completo"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Tu nombre"
              />
              <Input
                label="Correo electrónico"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="tu@email.com"
              />
              <Input
                label="Número de teléfono"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                inputMode="tel"
                placeholder="Ej: +57 300 000 0000"
              />
              <Input
                label="Lugar / Dirección"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="Ciudad, país o dirección completa"
              />
              <Input
                label="Contraseña"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                placeholder="••••••••"
              />

              <Button
                type="submit"
                loading={loading}
                className="bg-linear-to-r mt-2 w-full from-purple-600 to-fuchsia-600 text-base font-semibold text-white hover:from-purple-700 hover:to-fuchsia-700 focus:ring-purple-500"
              >
                {loading ? "Creando cuenta..." : "Registrarme"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-white">
                        {plan.name}
                      </p>
                      <p className="text-xs text-gray-300">
                        {plan.description}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-fuchsia-200">
                      {plan.currency} {plan.monthlyPrice}/mes
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-300">
                    Incluye hasta {plan.limits.branches} sede(s) y{" "}
                    {plan.limits.employees} employee(es).
                  </p>
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    loading={planAction === plan.id}
                    onClick={() => handleChoosePlan(plan)}
                  >
                    Elegir plan y hablar por WhatsApp
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-400">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-purple-300 hover:text-white">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
