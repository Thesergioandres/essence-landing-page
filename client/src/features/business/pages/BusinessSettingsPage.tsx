import { useEffect, useMemo, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { uploadService } from "../../common/services";
import { businessService } from "../services";
import type { BusinessFeatures } from "../types/business.types";

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
  incidents: true,
  expenses: true,
  assistant: false,
  reports: true,
  transfers: true,
  promotions: true,
  branches: true,
  employees: true,
  rankings: false,
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
  const [initialFeatures, setInitialFeatures] =
    useState<BusinessFeatures | null>(null);

  const featureGroups = useMemo(
    () => [
      {
        title: "Catalogo y ventas",
        desc: "Elementos basicos para vender y atender clientes.",
        items: [
          {
            key: "products" as const,
            label: "Productos",
            helper: "Catalogo, precios y fichas de producto.",
          },
          {
            key: "inventory" as const,
            label: "Inventario",
            helper: "Entradas, salidas y stock por ubicacion.",
          },
          {
            key: "sales" as const,
            label: "Ventas",
            helper: "Registro de ventas y control de pagos.",
          },
          {
            key: "customers" as const,
            label: "Clientes",
            helper: "Base de clientes y datos de contacto.",
          },
          {
            key: "credits" as const,
            label: "Creditos",
            helper: "Ventas a credito y cobros pendientes.",
          },
          {
            key: "defectiveProducts" as const,
            label: "Productos defectuosos",
            helper: "Garantias, devoluciones y perdidas.",
          },
        ],
      },
      {
        title: "Operaciones",
        desc: "Control interno y movimientos del negocio.",
        items: [
          {
            key: "branches" as const,
            label: "Sedes",
            helper: "Gestiona sucursales y sus inventarios.",
          },
          {
            key: "transfers" as const,
            label: "Transferencias",
            helper: "Movimientos de stock entre sedes.",
          },
          {
            key: "expenses" as const,
            label: "Gastos",
            helper: "Registro de egresos operativos.",
          },
          {
            key: "reports" as const,
            label: "Reportes",
            helper: "Indicadores y analitica del negocio.",
          },
          {
            key: "incidents" as const,
            label: "Incidencias",
            helper: "Control de problemas y alertas internas.",
          },
        ],
      },
      {
        title: "Equipo comercial",
        desc: "Gestiona y opera el canal de empleados.",
        items: [
          {
            key: "employees" as const,
            label: "Empleados",
            helper: "Usuarios externos con ventas propias.",
          },
          {
            key: "promotions" as const,
            label: "Promociones",
            helper: "Combos y ofertas especiales.",
          },
        ],
      },
      {
        title: "Asistencia",
        desc: "Herramientas de apoyo para el equipo.",
        items: [
          {
            key: "assistant" as const,
            label: "Business Assistant",
            helper: "Sugerencias y ayuda automatizada.",
          },
        ],
      },
    ],
    []
  );

  const featurePresets = useMemo(
    () => [
      {
        key: "full",
        title: "Suite completa",
        desc: "Activa todo el ecosistema de Essence.",
        features: {
          ...defaultFeatures,
          assistant: true,
          rankings: false,
        },
      },
      {
        key: "core",
        title: "Catalogo y ventas",
        desc: "Solo lo esencial para vender y controlar stock.",
        features: {
          products: true,
          inventory: true,
          sales: true,
          customers: true,
          credits: true,
          defectiveProducts: true,
          reports: true,
          branches: false,
          transfers: false,
          expenses: false,
          incidents: false,
          employees: false,
          rankings: false,
          promotions: false,
          assistant: false,
        } as BusinessFeatures,
      },
      {
        key: "employees",
        title: "Canal de empleados",
        desc: "Habilita la red comercial de empleados.",
        features: {
          products: true,
          inventory: true,
          sales: true,
          customers: true,
          credits: true,
          defectiveProducts: true,
          reports: true,
          branches: true,
          transfers: true,
          expenses: true,
          incidents: false,
          employees: true,
          rankings: false,
          promotions: true,
          assistant: false,
        } as BusinessFeatures,
      },
    ],
    []
  );

  useEffect(() => {
    if (business) {
      const resolvedFeatures =
        business.config?.features || features || defaultFeatures;
      setForm({
        name: business.name || "",
        description: business.description || "",
        contactEmail: business.contactEmail || "",
        contactPhone: business.contactPhone || "",
        contactWhatsapp: business.contactWhatsapp || "",
        contactLocation: business.contactLocation || "",
        logoUrl: business.logoUrl,
        logoPublicId: business.logoPublicId ?? null,
        features: resolvedFeatures,
      });
      setInitialFeatures(resolvedFeatures);
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

  const handleApplyPreset = (presetFeatures: BusinessFeatures) => {
    setForm(prev => ({
      ...prev,
      features: { ...presetFeatures },
    }));
    setMessage("Preset aplicado. Guarda para confirmar los cambios.");
  };

  const handleRestoreFeatures = () => {
    if (!initialFeatures) return;
    setForm(prev => ({
      ...prev,
      features: { ...initialFeatures },
    }));
    setMessage("Modulos restaurados a la configuracion actual.");
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
      await businessService.updateBusinessFeatures(
        businessId,
        form.features as any
      );
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
            Ajusta la identidad del negocio, los canales de contacto y los
            modulos que estaran activos para tu equipo.
          </p>
        </div>

        {!businessId && (
          <div className="mb-4 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4 text-yellow-200">
            No hay negocio seleccionado. Inicia sesión y selecciona un negocio
            para editarlo.
          </div>
        )}

        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-6 shadow-xl backdrop-blur">
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

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-purple-500/40 bg-purple-900/20 p-4">
              <p className="text-xs uppercase text-purple-200">Paso 1</p>
              <p className="mt-1 text-sm font-semibold text-white">
                Completa la identidad
              </p>
              <p className="mt-1 text-xs text-purple-100/80">
                Nombre, descripcion y logo visibles en catalogo.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-900/20 p-4">
              <p className="text-xs uppercase text-cyan-200">Paso 2</p>
              <p className="mt-1 text-sm font-semibold text-white">
                Define canales
              </p>
              <p className="mt-1 text-xs text-cyan-100/80">
                Datos para WhatsApp, llamadas y ubicacion.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 p-4">
              <p className="text-xs uppercase text-emerald-200">Paso 3</p>
              <p className="mt-1 text-sm font-semibold text-white">
                Activa modulos
              </p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Solo muestra funciones que vas a usar.
              </p>
            </div>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4">
                <p className="text-base font-semibold text-white">
                  Identidad del negocio
                </p>
                <p className="text-sm text-gray-400">
                  Asi se mostrara tu marca en el catalogo y en reportes.
                </p>
              </div>
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
                  <p className="mt-1 text-xs text-gray-400">
                    Nombre visible para clientes y empleados.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-200">
                    Descripcion
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Breve descripcion del negocio"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Ayuda a explicar tu propuesta y enfoque.
                  </p>
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
                        Formatos aceptados: JPG, PNG. Max 5MB.
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
                    Guarda los cambios para aplicar el logo en el catalogo.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4">
                <p className="text-base font-semibold text-white">
                  Canales de contacto
                </p>
                <p className="text-sm text-gray-400">
                  Datos que veran los clientes al contactarte.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <p className="mt-1 text-xs text-gray-400">
                    Usado en notificaciones y soporte.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-200">
                    Telefono de contacto
                  </label>
                  <input
                    name="contactPhone"
                    value={form.contactPhone}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ej: +57 3000000000"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Para llamadas o soporte directo.
                  </p>
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
                    placeholder="Numero para link de WhatsApp"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Se usa para crear el link rapido del catalogo.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-200">
                    Ubicacion
                  </label>
                  <input
                    name="contactLocation"
                    value={form.contactLocation}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ciudad / direccion"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Ayuda a contextualizar tu negocio.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Modulos activos
                  </p>
                  <p className="text-sm text-gray-400">
                    Activa solo lo que tu equipo necesita en el dia a dia.
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  Los cambios aplican al guardar.
                </span>
              </div>

              <div className="mb-5 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Presets recomendados
                    </p>
                    <p className="text-xs text-gray-400">
                      Aplica un grupo de modulos y luego ajusta detalles.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreFeatures}
                    className="text-xs font-semibold text-gray-300 transition hover:text-white"
                    disabled={!initialFeatures}
                  >
                    Restaurar configuracion actual
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {featurePresets.map(preset => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleApplyPreset(preset.features)}
                      className="rounded-lg border border-white/10 bg-white/5 p-3 text-left transition hover:border-purple-400/60 hover:bg-white/10"
                    >
                      <p className="text-sm font-semibold text-white">
                        {preset.title}
                      </p>
                      <p className="text-xs text-gray-400">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {featureGroups.map(group => (
                  <div
                    key={group.title}
                    className="rounded-lg border border-gray-700 bg-gray-900/40 p-4"
                  >
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-white">
                        {group.title}
                      </p>
                      <p className="text-xs text-gray-400">{group.desc}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {group.items.map(item =>
                        (() => {
                          const isActive = form.features?.[item.key];
                          const wasActive = initialFeatures?.[item.key];
                          const isDisabling = wasActive && !isActive;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => handleToggleFeature(item.key)}
                              className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition hover:border-purple-400/60 hover:text-white ${
                                isActive
                                  ? "border-purple-500/50 bg-purple-500/10 text-white"
                                  : "border-white/10 bg-white/0 text-gray-200"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-semibold">
                                  {item.label}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {item.helper}
                                </p>
                                {isDisabling && (
                                  <p className="mt-1 text-xs text-amber-300">
                                    Desactivado: podria ocultar datos
                                    existentes.
                                  </p>
                                )}
                              </div>
                              <span
                                className={`h-5 w-9 rounded-full border transition ${
                                  isActive
                                    ? "border-purple-400 bg-purple-500/30"
                                    : "border-white/20 bg-white/0"
                                }`}
                              >
                                <span
                                  className={`block h-4 w-4 translate-x-0.5 rounded-full bg-white transition ${
                                    isActive ? "translate-x-4" : ""
                                  }`}
                                />
                              </span>
                            </button>
                          );
                        })()
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading || !businessId}
                className="bg-linear-to-r w-full rounded-lg from-purple-600 to-pink-600 px-4 py-3 text-base font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar cambios"}
              </button>
              <p className="text-center text-xs text-gray-400">
                Revisa los modulos activos antes de guardar.
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
