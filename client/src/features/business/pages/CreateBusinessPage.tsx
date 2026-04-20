import { ArrowLeft, Building2, Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../../context/BusinessContext";
import { businessService } from "../../business/services";
import { uploadService } from "../../common/services";
import type { BusinessFeatures } from "../types/business.types";

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

interface FormState {
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactLocation: string;
  logoUrl?: string;
  logoPublicId?: string;
  features: BusinessFeatures;
}

export default function CreateBusiness() {
  const navigate = useNavigate();
  const { refresh, selectBusiness, memberships } = useBusiness();
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
    contactWhatsapp: "",
    contactLocation: "",
    logoUrl: undefined,
    logoPublicId: undefined,
    features: defaultFeatures,
  });
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      setError(null);

      const data = await uploadService.uploadImage(file);
      setForm(prev => ({
        ...prev,
        logoUrl: data.url,
        logoPublicId: data.publicId,
      }));
    } catch (err) {
      console.error("Error uploading logo:", err);
      setError("Error al subir el logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre del negocio es obligatorio");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { business } = await businessService.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactWhatsapp: form.contactWhatsapp.trim() || undefined,
        contactLocation: form.contactLocation.trim() || undefined,
        logoUrl: form.logoUrl,
        logoPublicId: form.logoPublicId,
      } as any);

      setSuccess(true);

      // Refrescar memberships y seleccionar el nuevo negocio
      await refresh();
      setTimeout(() => {
        selectBusiness(business._id);
        navigate("/admin/analytics");
      }, 1500);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al crear el negocio";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="rounded-2xl border border-emerald-800/50 bg-gradient-to-br from-emerald-900/40 to-gray-900 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">
            ¡Negocio creado exitosamente!
          </h2>
          <p className="text-gray-400">Redirigiendo al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-hidden p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-300 transition hover:border-gray-600 hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm uppercase tracking-wide text-purple-300/70">
            Nuevo
          </p>
          <h1 className="text-2xl font-bold text-white">Crear negocio</h1>
        </div>
      </div>

      {/* Info box */}
      {memberships.length > 0 && (
        <div className="rounded-lg border border-blue-800/50 bg-blue-950/30 p-4">
          <p className="text-sm text-blue-300">
            Ya tienes {memberships.length} negocio(s). Puedes crear negocios
            adicionales y cambiar entre ellos desde el selector en la barra
            lateral.
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-6 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/20 p-2">
              <Building2 className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Información del negocio
              </h2>
              <p className="text-sm text-gray-400">
                Datos básicos de tu nuevo negocio
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Logo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Logo del negocio
              </label>
              <div className="flex items-center gap-4">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="h-20 w-20 rounded-lg border border-gray-700 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-800">
                    <Building2 className="h-8 w-8 text-gray-500" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 transition hover:border-gray-600 hover:bg-gray-700">
                    {uploadingLogo ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Subiendo...
                      </span>
                    ) : (
                      "Subir logo"
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG o WebP. Máximo 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Nombre del negocio *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ej: Mi Tienda Online"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Descripción
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Breve descripción de tu negocio..."
                rows={3}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Email de contacto
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={form.contactEmail}
                  onChange={handleChange}
                  placeholder="contacto@minegocio.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={form.contactPhone}
                  onChange={handleChange}
                  placeholder="+57 300 123 4567"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  name="contactWhatsapp"
                  value={form.contactWhatsapp}
                  onChange={handleChange}
                  placeholder="+57 300 123 4567"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Ubicación
                </label>
                <input
                  type="text"
                  name="contactLocation"
                  value={form.contactLocation}
                  onChange={handleChange}
                  placeholder="Ciudad, País"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-3 text-gray-200 transition hover:border-gray-600 hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Crear negocio
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
