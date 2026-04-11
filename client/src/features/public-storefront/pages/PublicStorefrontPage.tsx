import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BoldTemplate from "../components/templates/BoldTemplate";
import MinimalTemplate from "../components/templates/MinimalTemplate";
import ModernTemplate from "../components/templates/ModernTemplate";
import { publicStorefrontService } from "../services/publicStorefront.service";
import type {
  LandingTemplate,
  PublicStorefrontData,
} from "../types/publicStorefront.types";

const templateMap: Record<LandingTemplate, typeof ModernTemplate> = {
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
};

export default function PublicStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [storefront, setStorefront] = useState<PublicStorefrontData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isActive = true;

    const fetchStorefront = async () => {
      if (!slug) {
        setError("Slug invalido");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await publicStorefrontService.getBySlug(slug);
        if (!isActive) return;
        setStorefront(response);
      } catch (requestError) {
        if (!isActive) return;
        const message =
          (requestError as { response?: { data?: { message?: string } } })
            ?.response?.data?.message || "No fue posible cargar esta tienda.";
        setError(message);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchStorefront();

    return () => {
      isActive = false;
    };
  }, [slug]);

  const SelectedTemplate = useMemo(() => {
    const selectedTemplate = storefront?.business?.landingTemplate || "modern";
    return templateMap[selectedTemplate] || ModernTemplate;
  }, [storefront?.business?.landingTemplate]);

  if (loading) {
    return (
      <div className="bg-linear-to-br min-h-screen from-slate-950 via-slate-900 to-slate-800">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
            <div className="h-4 w-36 animate-pulse rounded bg-white/20" />
            <div className="mt-4 h-8 w-56 animate-pulse rounded bg-white/20" />
            <div className="mt-6 h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="bg-linear-to-br min-h-screen from-slate-950 via-zinc-900 to-zinc-800 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-red-400/40 bg-red-500/10 p-8 text-center shadow-xl backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-200">
              Storefront no disponible
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              No pudimos abrir esta tienda
            </h1>
            <p className="mt-3 text-sm text-red-100/90">
              {error || "Verifica el enlace e intenta nuevamente."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <SelectedTemplate storefront={storefront} />;
}
