import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";
import { useBusiness } from "../../../context/BusinessContext";
import { businessService } from "../../business/services";
import { uploadService } from "../../common/services";
import type { BusinessFeatures } from "../../../types";

const defaultFeatures: BusinessFeatures = {
  products: true,
  inventory: true,
  sales: true,
  gamification: true,
  incidents: true,
  expenses: true,
  assistant: false,
  reports: true,
  transfers: true,
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh, memberships } = useBusiness();
  const [form, setForm] = useState({
    name: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
    contactWhatsapp: "",
    contactLocation: "",
    features: defaultFeatures,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (memberships.length > 0) {
      // Si ya tiene negocio, llévalo directo al dashboard
      const role = memberships[0]?.role;
      navigate(
        role === "admin" ? "/admin/dashboard" : "/distributor/dashboard",
        { replace: true }
      );
    }
  }, [memberships, navigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoFile(file ?? null);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleToggleFeature = (key: keyof BusinessFeatures) => {
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features?.[key] },
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Primero subir logo si existe
      let logoUrl: string | undefined;
      let logoPublicId: string | undefined;
      if (logoFile) {
        try {
          const uploadResult = await uploadService.uploadImage(logoFile);
          logoUrl = uploadResult.url;
          logoPublicId = uploadResult.publicId;
        } catch (uploadErr) {
          console.error("Logo upload failed", uploadErr);
          // Continuar sin logo si falla la subida
        }
      }

      const { business } = await businessService.create({
        ...form,
        logoUrl,
        logoPublicId,
      });
      localStorage.setItem("businessId", business._id);
      await refresh();
      navigate("/distributor/dashboard", { replace: true });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo crear el negocio";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070910] text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
            Bienvenido
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Crea tu primer negocio
          </h1>
          <p className="text-sm text-gray-300 sm:text-base">
            Completa los datos básicos y activa los módulos que necesitas. Luego
            podrás ajustarlos en Configurar negocio.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-purple-900/40 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Nombre del negocio
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: Mi empresa"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Breve descripción"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Correo de contacto
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={form.contactEmail}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Teléfono
                </label>
                <input
                  name="contactPhone"
                  value={form.contactPhone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: +57 3000000000"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  WhatsApp
                </label>
                <input
                  name="contactWhatsapp"
                  value={form.contactWhatsapp}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Número para WhatsApp"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Ubicación
                </label>
                <input
                  name="contactLocation"
                  value={form.contactLocation}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ciudad / dirección"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Logo del negocio (opcional)
                </label>
                <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo seleccionado"
                        className="h-14 w-auto rounded-md border border-white/10 bg-gray-900 object-contain p-2"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-white/20 bg-gray-900/50 text-xs text-gray-400">
                        PNG/JPG
                      </div>
                    )}
                    <p className="text-sm text-gray-300">
                      Sube el logo de tu negocio. Se mostrará en la navegación
                      para identificar tu empresa. Recomendado 512x512 png.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-purple-400 hover:text-purple-100">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                      Subir logo
                    </label>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-200 transition hover:border-red-400 hover:text-red-200"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Funcionalidades activas
                  </p>
                  <p className="text-sm text-gray-400">
                    Activa los módulos que necesitas para empezar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(
                  [
                    "products",
                    "inventory",
                    "sales",
                    "expenses",
                    "reports",
                    "assistant",
                    "gamification",
                    "transfers",
                    "incidents",
                    "promotions",
                  ] as (keyof BusinessFeatures)[]
                ).map(key => {
                  const meta: Record<
                    keyof BusinessFeatures,
                    { label: string; desc: string }
                  > = {
                    products: {
                      label: "Productos",
                      desc: "Catálogo con imágenes, precios y comisiones.",
                    },
                    inventory: {
                      label: "Inventario",
                      desc: "Stock, alertas de bajo inventario y bodegas.",
                    },
                    sales: {
                      label: "Ventas",
                      desc: "Registro de ventas, filtros por fecha y análisis.",
                    },
                    gamification: {
                      label: "Gamificación",
                      desc: "Rankings, retos y premios para tu equipo.",
                    },
                    incidents: {
                      label: "Incidencias",
                      desc: "Bitácora de problemas y seguimiento de casos.",
                    },
                    expenses: {
                      label: "Gastos",
                      desc: "Control de egresos y categorías de gasto.",
                    },
                    assistant: {
                      label: "Business Assistant",
                      desc: "Recomendaciones automáticas y sugerencias.",
                    },
                    reports: {
                      label: "Reportes",
                      desc: "KPIs, dashboards y reportes descargables.",
                    },
                    transfers: {
                      label: "Transferencias",
                      desc: "Movimientos entre bodegas y traspasos.",
                    },
                    promotions: {
                      label: "Promociones",
                      desc: "Ofertas, descuentos y campañas por temporada.",
                    },
                    branches: {
                      label: "Sedes",
                      desc: "Gestión de sucursales y puntos de venta.",
                    },
                    distributors: {
                      label: "Distribuidores",
                      desc: "Red de distribución y comisiones.",
                    },
                    rankings: {
                      label: "Rankings",
                      desc: "Clasificaciones y tablas de posiciones.",
                    },
                    credits: {
                      label: "Créditos",
                      desc: "Ventas a crédito y gestión de pagos.",
                    },
                    customers: {
                      label: "Clientes",
                      desc: "Gestión de clientes y contactos.",
                    },
                    defectiveProducts: {
                      label: "Productos Defectuosos",
                      desc: "Control de productos con defectos.",
                    },
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleToggleFeature(key)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition hover:border-purple-400/60 hover:text-white ${
                        form.features?.[key]
                          ? "border-purple-500/50 bg-purple-500/10 text-white"
                          : "border-white/10 bg-white/0 text-gray-200"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold ${
                              form.features?.[key]
                                ? "border-purple-400 bg-purple-500 text-white"
                                : "border-white/20 bg-white/10 text-gray-300"
                            }`}
                          >
                            {form.features?.[key] ? "On" : "Off"}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {meta[key].label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {meta[key].desc}
                        </p>
                      </div>
                      <span
                        className={`h-5 w-9 rounded-full border transition ${
                          form.features?.[key]
                            ? "border-purple-400 bg-purple-500/30"
                            : "border-white/20 bg-white/0"
                        }`}
                      >
                        <span
                          className={`block h-4 w-4 translate-x-0.5 rounded-full bg-white transition ${
                            form.features?.[key] ? "translate-x-4" : ""
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-3 text-base font-semibold text-white transition hover:from-purple-700 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#070910] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creando negocio..." : "Crear y continuar"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
