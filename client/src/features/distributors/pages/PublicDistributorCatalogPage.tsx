import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../../api/axios";
import { LoadingSpinner } from "../../../shared/components/ui";
import type { Product } from "../../inventory/types/product.types";

interface DistributorInfo {
  name: string;
  phone?: string;
  email?: string;
}

export default function PublicDistributorCatalog() {
  const { distributorId } = useParams<{ distributorId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [distributor, setDistributor] = useState<DistributorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    []
  );

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true);
        // Obtener productos del distribuidor
        const response = await api.get(
          `/distributors/${distributorId}/catalog`
        );
        setProducts(response.data.products || []);
        setDistributor(response.data.distributor || null);
      } catch (err: any) {
        setError("No se pudo cargar el catálogo");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (distributorId) {
      loadCatalog();
    }
  }, [distributorId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Catalogo de ${distributor?.name || "productos"}`,
          text: "Explora este catalogo de productos.",
          url: shareUrl,
        });
        return;
      } catch (error) {
        console.error("Error al compartir:", error);
      }
    }

    try {
      const copyToClipboard = async (text: string) => {
        if (!text) return false;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
      };

      const copied = await copyToClipboard(shareUrl);
      if (!copied) {
        throw new Error("copy_failed");
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error("Error al copiar:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1210]">
        <LoadingSpinner size="lg" message="Cargando catálogo..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1210] p-6">
        <div className="text-center">
          <div className="mb-4 text-6xl">😕</div>
          <h1 className="mb-2 text-2xl font-bold text-white">{error}</h1>
          <p className="text-gray-400">Verifica que el enlace sea correcto</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1210] text-slate-100">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">
                Catalogo disponible
              </p>
              <h1 className="text-4xl font-bold text-white">
                Catalogo de {distributor?.name || "productos"}
              </h1>
              {distributor?.phone && (
                <p className="mt-2 text-gray-300">
                  Telefono: {distributor.phone}
                </p>
              )}
              {distributor?.email && (
                <p className="mt-1 text-gray-400">Email: {distributor.email}</p>
              )}
            </div>
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <button
                onClick={handleShare}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400"
              >
                Compartir catalogo
              </button>
              {copiedLink && (
                <span className="text-xs text-emerald-300">
                  Enlace copiado.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-sm">
            <h2 className="mb-2 text-xl font-semibold text-white">
              No hay productos disponibles
            </h2>
            <p className="text-gray-400">
              El catalogo esta temporalmente vacio
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map(product => (
              <div
                key={product._id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-500/10"
              >
                {/* Product Image */}
                <div className="aspect-square bg-gray-950/60">
                  {product.image?.url ? (
                    <img
                      src={product.image.url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-6xl">
                      📦
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-white">
                    {product.name}
                  </h3>

                  {product.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-gray-400">
                      {product.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-amber-300">
                        {formatCurrency(product.clientPrice || 0)}
                      </p>
                    </div>
                    {product.totalStock !== undefined && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Disponible</p>
                        <p className="font-semibold text-emerald-300">
                          {product.totalStock > 0
                            ? `${product.totalStock} unid.`
                            : "Agotado"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-white/5 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-400">
          <p>Para realizar un pedido, contacta directamente al distribuidor</p>
        </div>
      </div>
    </div>
  );
}
