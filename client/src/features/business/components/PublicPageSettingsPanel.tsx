import { useEffect, useMemo, useState } from "react";
import { businessService } from "../services";
import type { Business } from "../types/business.types";

type LandingTemplate = "modern" | "minimal" | "bold";

interface PublicPageSettingsPanelProps {
  businessId: string | null;
  business: Business | null;
  onRefresh: () => Promise<void>;
}

const normalizeSlug = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const buildInitialSlug = (business: Business | null) => {
  if (!business) return "";
  return normalizeSlug(business.slug || business.name || "");
};

const templateOptions: Array<{
  id: LandingTemplate;
  title: string;
  description: string;
  badge: string;
  previewClassName: string;
}> = [
  {
    id: "modern",
    title: "Modern",
    description: "Hero inmersivo, vidrio y gradientes elegantes.",
    badge: "Top conversion",
    previewClassName:
      "bg-gradient-to-r from-slate-900 via-slate-700 to-cyan-600 text-white",
  },
  {
    id: "minimal",
    title: "Minimal",
    description: "Espacio blanco, foco en producto y lectura limpia.",
    badge: "Editorial",
    previewClassName:
      "bg-gradient-to-r from-zinc-100 via-white to-zinc-200 text-zinc-900",
  },
  {
    id: "bold",
    title: "Bold",
    description: "Contraste fuerte y caracter visual de alto impacto.",
    badge: "Statement",
    previewClassName:
      "bg-gradient-to-r from-black via-zinc-900 to-amber-500 text-amber-100",
  },
];

export default function PublicPageSettingsPanel({
  businessId,
  business,
  onRefresh,
}: PublicPageSettingsPanelProps) {
  const [slugInput, setSlugInput] = useState<string>(
    buildInitialSlug(business)
  );
  const [landingTemplate, setLandingTemplate] = useState<LandingTemplate>(
    (business?.landingTemplate as LandingTemplate) || "modern"
  );
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugHint, setSlugHint] = useState<string>("");
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedSlug = useMemo(() => normalizeSlug(slugInput), [slugInput]);

  useEffect(() => {
    setSlugInput(buildInitialSlug(business));
    setLandingTemplate(
      (business?.landingTemplate as LandingTemplate) || "modern"
    );
  }, [business]);

  useEffect(() => {
    let isActive = true;

    const validateSlug = async () => {
      if (!businessId) {
        return;
      }

      if (!normalizedSlug) {
        setSlugAvailable(null);
        setSlugHint("Define un slug para publicar tu tienda.");
        return;
      }

      if (normalizedSlug.length < 3) {
        setSlugAvailable(false);
        setSlugHint("El slug debe tener al menos 3 caracteres.");
        return;
      }

      setCheckingSlug(true);
      setSlugHint("Validando disponibilidad...");

      try {
        const result = await businessService.checkSlugAvailability(
          businessId,
          normalizedSlug
        );

        if (!isActive) return;

        setSlugAvailable(result.available);
        setSlugHint(
          result.available
            ? "Slug disponible. Puedes usarlo."
            : "Este slug ya esta en uso."
        );
      } catch (validationError) {
        if (!isActive) return;
        setSlugAvailable(false);
        setSlugHint("No fue posible validar el slug en este momento.");
      } finally {
        if (isActive) {
          setCheckingSlug(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      void validateSlug();
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [businessId, normalizedSlug]);

  const storefrontUrl = normalizedSlug ? `/tienda/${normalizedSlug}` : "";

  const handleSave = async () => {
    if (!businessId) {
      setError("Selecciona un negocio antes de configurar la pagina publica.");
      return;
    }

    if (!normalizedSlug || normalizedSlug.length < 3) {
      setError("El slug debe tener al menos 3 caracteres validos.");
      return;
    }

    if (slugAvailable === false) {
      setError("Debes elegir un slug disponible antes de guardar.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await businessService.updatePublicStorefront(businessId, {
        slug: normalizedSlug,
        landingTemplate,
      });

      await onRefresh();
      setSuccess("Pagina publica actualizada correctamente.");
    } catch (saveError) {
      const errorMessage =
        (saveError as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "No se pudo guardar la pagina publica.";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenStorefront = () => {
    if (!storefrontUrl) return;
    window.open(storefrontUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-400/60 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 p-4 text-sm text-emerald-200 backdrop-blur-sm">
          {success}
        </div>
      )}

      <section className="bg-linear-to-br rounded-2xl border border-white/10 from-slate-950/70 via-slate-900/60 to-cyan-950/50 p-6 shadow-xl backdrop-blur">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
            Mi Pagina Publica
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">
            Escaparate digital del negocio
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Configura tu URL publica y selecciona la plantilla visual de tu
            tienda para captar clientes en B2B2C.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              URL personalizada
            </label>
            <div className="rounded-xl border border-white/15 bg-black/20 p-3 backdrop-blur">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                Vista previa
              </p>
              <p className="truncate text-sm font-medium text-cyan-100">
                /tienda/{normalizedSlug || "tu-negocio"}
              </p>
            </div>
            <input
              value={slugInput}
              onChange={event => {
                setSlugInput(event.target.value);
                setSuccess(null);
                setError(null);
              }}
              placeholder="ej: essence-vape-medellin"
              className="mt-3 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/30"
            />
            <p
              className={`mt-2 text-xs ${
                slugAvailable === true
                  ? "text-emerald-300"
                  : slugAvailable === false
                    ? "text-amber-300"
                    : "text-slate-400"
              }`}
            >
              {checkingSlug ? "Validando slug..." : slugHint}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-white">Acciones rapidas</p>
            <p className="mt-1 text-xs text-slate-400">
              Abre tu storefront en una pestaña nueva para revisar el resultado.
            </p>
            <button
              type="button"
              onClick={handleOpenStorefront}
              disabled={!normalizedSlug}
              className="bg-linear-to-r mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.01] hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ver mi tienda
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-lg backdrop-blur">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Plantilla visual</h3>
          <p className="text-sm text-slate-300">
            Selecciona el estilo que mejor representa tu marca.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {templateOptions.map(template => {
            const isSelected = landingTemplate === template.id;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setLandingTemplate(template.id);
                  setSuccess(null);
                }}
                className={`rounded-2xl border p-4 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-cyan-400/70 bg-cyan-500/10 shadow-xl shadow-cyan-500/20"
                    : "border-white/10 bg-white/5 hover:border-cyan-300/50 hover:bg-white/10"
                }`}
              >
                <div
                  className={`h-28 rounded-xl p-3 shadow-lg transition-all duration-300 ${template.previewClassName}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] opacity-80">
                    {template.badge}
                  </p>
                  <p className="mt-2 text-sm font-bold">{template.title}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {template.description}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {template.title}
                  </span>
                  {isSelected && (
                    <span className="rounded-full border border-cyan-300/50 bg-cyan-400/20 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                      Seleccionada
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !businessId || slugAvailable === false}
        className="bg-linear-to-r inline-flex min-h-11 w-full items-center justify-center rounded-xl from-fuchsia-500 via-purple-500 to-blue-600 px-4 py-3 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/25 transition-all duration-300 hover:scale-[1.01] hover:from-fuchsia-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Guardando pagina publica..." : "Guardar pagina publica"}
      </button>
    </div>
  );
}
