import { Suspense, useEffect, useMemo, useState } from "react";
import { businessService, uploadService } from "../api/services";
import PushNotificationSettings from "../components/PushNotificationSettings";
import { useBusiness } from "../context/BusinessContext";
import type { BusinessFeatures } from "../types";
import AuditLogs from "./AuditLogs";
import Distributors from "./Distributors";
import GamificationConfig from "./GamificationConfig";
import Rankings from "./Rankings";

interface FormState {
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactLocation: string;
  logoUrl?: string;
  logoPublicId?: string | null;
  features: BusinessFeatures;
}

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
  promotions: true,
  branches: true,
  distributors: true,
  rankings: true,
  credits: true,
  customers: true,
  defectiveProducts: true,
};

export default function BusinessSettings() {
  const { business, businessId, refresh, features } = useBusiness();
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
    contactWhatsapp: "",
    contactLocation: "",
    logoUrl: undefined,
    logoPublicId: null,
    features: defaultFeatures,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<
    | "business"
    | "distributors"
    | "gamification"
    | "rankings"
    | "audit"
    | "notifications"
  >("business");

  const sectionCards = useMemo(
    () => [
      {
        key: "business" as const,
        title: "Datos del negocio",
        desc: "Información general y contacto",
      },
      {
        key: "distributors" as const,
        title: "Distribuidores",
        desc: "Gestiona tu red de distribuidores",
      },
      {
        key: "gamification" as const,
        title: "Gamificación",
        desc: "Configura puntos y rankings",
      },
      {
        key: "rankings" as const,
        title: "Rankings",
        desc: "Visualiza la clasificación",
      },
      {
        key: "audit" as const,
        title: "Auditoría",
        desc: "Historial de acciones y logs",
      },
      {
        key: "notifications" as const,
        title: "Notificaciones",
        desc: "Configura notificaciones push",
      },
    ],
    []
  );

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || "",
        description: business.description || "",
        contactEmail: business.contactEmail || "",
        contactPhone: business.contactPhone || "",
        contactWhatsapp: business.contactWhatsapp || "",
        contactLocation: business.contactLocation || "",
        logoUrl: business.logoUrl,
        logoPublicId: business.logoPublicId ?? null,
        features: business.config?.features || features || defaultFeatures,
      });
    }
  }, [business, features]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleToggleFeature = (key: keyof BusinessFeatures) => {
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features?.[key] },
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!businessId) {
      setError("Selecciona un negocio antes de actualizar.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await businessService.updateBusiness(businessId, {
        name: form.name,
        description: form.description,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        contactWhatsapp: form.contactWhatsapp,
        contactLocation: form.contactLocation,
        logoUrl: form.logoUrl,
        logoPublicId: form.logoPublicId ?? undefined,
      });
      await businessService.updateBusinessFeatures(businessId, form.features);
      setMessage("Datos del negocio actualizados");
      await refresh();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo actualizar el negocio";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const image = await uploadService.uploadImage(file);
      setForm(prev => ({
        ...prev,
        logoUrl: image.url,
        logoPublicId: image.publicId,
      }));
      setMessage("Logo actualizado (pendiente de guardar)");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo subir el logo";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({ ...prev, logoUrl: undefined, logoPublicId: null }));
    setMessage("Logo eliminado (pendiente de guardar)");
  };

  return (
    <div className="bg-linear-to-br min-h-screen from-gray-900 via-purple-900/20 to-gray-900">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Configurar negocio
          </h1>
          <p className="mt-2 text-sm text-gray-400 sm:text-base">
            Actualiza la información de contacto que usa el catálogo y los
            enlaces de WhatsApp.
          </p>
        </div>

        <div className="mb-8 grid gap-4 rounded-xl border border-gray-800 bg-gray-800/60 p-4 sm:grid-cols-2">
          {sectionCards.map(link => (
            <button
              type="button"
              key={link.key}
              onClick={() => setSelectedView(link.key)}
              className={`group flex items-center justify-between rounded-lg border px-4 py-3 text-left transition hover:border-purple-400/60 hover:bg-white/10 ${
                selectedView === link.key
                  ? "border-purple-400/70 bg-white/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-purple-100">
                  {link.title}
                </p>
                <p className="text-xs text-gray-400">{link.desc}</p>
              </div>
              <span className="text-sm text-purple-200 group-hover:translate-x-1 group-hover:text-purple-100">
                →
              </span>
            </button>
          ))}
        </div>

        {!businessId && (
          <div className="mb-4 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4 text-yellow-200">
            No hay negocio seleccionado. Inicia sesión y selecciona un negocio
            para editarlo.
          </div>
        )}

        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-6 shadow-xl backdrop-blur">
          <Suspense fallback={<div className="text-white">Cargando...</div>}>
            {selectedView === "business" && (
              <>
                {error && (
                  <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="mb-4 rounded-lg border border-green-500 bg-green-500/10 p-3 text-sm text-green-300">
                    {message}
                  </div>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-semibold text-gray-200">
                        Nombre del negocio
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Ej: Essence"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-semibold text-gray-200">
                        Descripción
                      </label>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Breve descripción del negocio"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-200">
                        Correo de contacto
                      </label>
                      <input
                        type="email"
                        name="contactEmail"
                        value={form.contactEmail}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="correo@ejemplo.com"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-200">
                        Teléfono de contacto
                      </label>
                      <input
                        name="contactPhone"
                        value={form.contactPhone}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Ej: +57 3000000000"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-200">
                        WhatsApp
                      </label>
                      <input
                        name="contactWhatsapp"
                        value={form.contactWhatsapp}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Número para link de WhatsApp"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-200">
                        Ubicación
                      </label>
                      <input
                        name="contactLocation"
                        value={form.contactLocation}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Ciudad / dirección"
                      />
                    </div>

                    <div className="space-y-3 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-gray-200">
                          Logo del negocio
                        </label>
                        {form.logoUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="text-xs font-semibold text-red-300 hover:text-red-200"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900/50 p-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
                            {form.logoUrl ? (
                              <img
                                src={form.logoUrl}
                                alt="Logo"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                Sin logo
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            Formatos aceptados: JPG, PNG. Máx 5MB.
                          </div>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-purple-500/60 px-3 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/10">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e =>
                              handleLogoUpload(e.target.files?.[0] || null)
                            }
                          />
                          Subir logo
                        </label>
                      </div>
                      <p className="text-xs text-gray-400">
                        Guarda los cambios para aplicar el logo en el catálogo.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">
                          Funcionalidades activas
                        </p>
                        <p className="text-sm text-gray-400">
                          Enciende o apaga módulos según lo que usa este
                          negocio.
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
                          "branches",
                          "distributors",
                          "rankings",
                          "credits",
                          "customers",
                          "defectiveProducts",
                        ] as (keyof BusinessFeatures)[]
                      ).map(key => {
                        const labelMap: Record<keyof BusinessFeatures, string> =
                          {
                            products: "Productos",
                            inventory: "Inventario",
                            sales: "Ventas",
                            gamification: "Gamificación",
                            incidents: "Incidencias",
                            expenses: "Gastos",
                            assistant: "Business Assistant",
                            reports: "Reportes",
                            transfers: "Transferencias",
                            promotions: "Promociones",
                            branches: "Sedes",
                            distributors: "Distribuidores",
                            rankings: "Rankings",
                            credits: "Créditos",
                            customers: "Clientes",
                            defectiveProducts: "Productos Defectuosos",
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
                            <div>
                              <p className="text-sm font-semibold">
                                {labelMap[key]}
                              </p>
                              <p className="text-xs text-gray-400">
                                {form.features?.[key]
                                  ? "Activo para este negocio"
                                  : "Desactivado para este negocio"}
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
                    disabled={loading || !businessId}
                    className="bg-linear-to-r w-full rounded-lg from-purple-600 to-pink-600 px-4 py-3 text-base font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Guardando..." : "Guardar cambios"}
                  </button>
                </form>
              </>
            )}

            {selectedView === "distributors" && <Distributors />}
            {selectedView === "gamification" && <GamificationConfig />}
            {selectedView === "rankings" && <Rankings />}
            {selectedView === "audit" && <AuditLogs />}
            {selectedView === "notifications" && <PushNotificationSettings />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
