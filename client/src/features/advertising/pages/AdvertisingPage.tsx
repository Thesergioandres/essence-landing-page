/**
 * AdvertisingPage — Generador de Publicidad (Auto-Ads)
 *
 * Genera automáticamente banners promocionales usando los productos
 * del inventario. El usuario puede descargar, compartir o copiar
 * el texto de venta con un solo clic.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { useProducts } from "../../inventory/hooks/useProducts";
import type { Product } from "../../inventory/types/product.types";
import { promotionService } from "../../settings/services";
import type { Promotion } from "../../settings/types/promotion.types";
import AdCard from "../components/AdCard";
import type { AdProduct, TemplateType } from "../types/advertising.types";
import { templateList } from "../utils/templateThemes";

const TEMPLATES: TemplateType[] = templateList.map(t => t.id);

/** Convierte un Product del inventario a un AdProduct simplificado */
function toAdProduct(p: Product): AdProduct {
  return {
    _id: p._id,
    name: p.name,
    price: p.clientPrice ?? p.suggestedPrice ?? p.employeePrice,
    originalPrice: p.suggestedPrice ?? undefined,
    image: p.image?.url,
    category:
      typeof p.category === "object" && p.category !== null
        ? p.category.name
        : undefined,
    description: p.description,
  };
}

/** Elige N productos aleatorios sin repetir */
function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  while (result.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getMarginScore(product: Product): number {
  const salePrice =
    product.clientPrice ?? product.suggestedPrice ?? product.employeePrice;
  if (!salePrice || !product.purchasePrice) return 0;
  const margin = salePrice - product.purchasePrice;
  if (margin <= 0) return 0;
  return Math.min(25, margin / 2);
}

const getPromotionPrice = (promo: Promotion) => {
  if (typeof promo.promotionPrice === "number") return promo.promotionPrice;
  if (typeof promo.value === "number" && promo.type === "fixed") {
    return promo.value;
  }
  if (
    promo.discount?.type === "percentage" &&
    typeof promo.originalPrice === "number"
  ) {
    return promo.originalPrice * (1 - promo.discount.value / 100);
  }
  if (
    promo.discount?.type === "amount" &&
    typeof promo.originalPrice === "number"
  ) {
    return promo.originalPrice - promo.discount.value;
  }
  if (typeof promo.originalPrice === "number") return promo.originalPrice;
  return 0;
};

export default function AdvertisingPage() {
  const { products, loading, error } = useProducts();
  const { business } = useBusiness();
  const logoUrl = useBrandLogo();
  const productIndex = useMemo(
    () => new Map(products.map(product => [product._id, product])),
    [products]
  );

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<
    TemplateType | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [showOnlyWithImage, setShowOnlyWithImage] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  // Productos activos con stock
  const activeProducts = useMemo(
    () => products.filter(p => p.active !== false).map(toAdProduct),
    [products]
  );

  // "Sugerencias del Día" — 6 productos aleatorios (se regeneran con el botón)
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const promotedProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const promo of promotions) {
      for (const item of promo.comboItems || []) {
        if (typeof item.product === "string") {
          ids.add(item.product);
        } else if (item.product?._id) {
          ids.add(item.product._id);
        }
      }
      for (const productId of promo.applicableProducts || []) {
        ids.add(productId);
      }
    }
    return ids;
  }, [promotions]);

  const suggestions = useMemo(() => {
    const activeInventory = products.filter(
      product => product.active !== false
    );
    const pool = activeInventory.filter(product => {
      const productPrice =
        product.clientPrice ??
        product.suggestedPrice ??
        product.employeePrice;
      return typeof productPrice === "number" && productPrice > 0;
    });

    const ranked = pool
      .map(product => {
        const stockScore = Math.min(
          20,
          Math.max(0, (product.totalStock || 0) / 5)
        );
        const imageScore = product.image?.url ? 18 : 0;
        const featuredScore = product.featured ? 8 : 0;
        const promotionScore = promotedProductIds.has(product._id) ? 30 : 0;
        const marginScore = getMarginScore(product);
        const seedNoise =
          ((hashText(`${product._id}:${suggestionSeed}`) % 11) - 5) * 0.6;

        const score =
          stockScore +
          imageScore +
          featuredScore +
          promotionScore +
          marginScore +
          seedNoise;

        return {
          score,
          adProduct: toAdProduct(product),
        };
      })
      .sort((left, right) => right.score - left.score)
      .map(item => item.adProduct);

    const topRanked = ranked.slice(0, 6);
    if (topRanked.length > 0) return topRanked;

    const withImage = activeProducts.filter(product => product.image);
    return pickRandom(withImage.length >= 6 ? withImage : activeProducts, 6);
  }, [activeProducts, products, promotedProductIds, suggestionSeed]);

  const refreshSuggestions = useCallback(
    () => setSuggestionSeed(s => s + 1),
    []
  );

  const loadPromotions = useCallback(async () => {
    try {
      setPromotionsLoading(true);
      setPromotionsError(null);
      const response = await promotionService.getAll({ status: "active" });
      const activePromos = (response.promotions || []).filter(
        promo => promo?.showInCatalog !== false
      );
      setPromotions(activePromos);
    } catch (err) {
      console.error("Error loading promotions for advertising:", err);
      setPromotionsError("Error al cargar promociones activas");
      setPromotions([]);
    } finally {
      setPromotionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromotions();

    const handlePromotionsUpdated = () => {
      void loadPromotions();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "promotions-updated") {
        void loadPromotions();
      }
    };

    window.addEventListener("promotions-updated", handlePromotionsUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("promotions-updated", handlePromotionsUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadPromotions]);

  // Filtrado de la galería completa
  const filteredProducts = useMemo(() => {
    let list = activeProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }
    if (showOnlyWithImage) {
      list = list.filter(p => p.image);
    }
    return list;
  }, [activeProducts, search, showOnlyWithImage]);

  useEffect(() => {
    setVisibleCount(24);
  }, [search, showOnlyWithImage, selectedTemplate]);

  const templatesToShow: TemplateType[] =
    selectedTemplate === "all" ? TEMPLATES : [selectedTemplate];

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const businessName = business?.name || "";
  const getPromotionProducts = useCallback(
    (promo: Promotion) => {
      if (promo.comboItems && promo.comboItems.length > 0) {
        return promo.comboItems
          .map(item =>
            typeof item.product === "string"
              ? productIndex.get(item.product)
              : item.product
          )
          .filter(Boolean);
      }

      if (promo.applicableProducts && promo.applicableProducts.length > 0) {
        return promo.applicableProducts
          .map(productId => productIndex.get(productId))
          .filter(Boolean);
      }

      return [] as Product[];
    },
    [productIndex]
  );

  const promoAds = useMemo(() => {
    return promotions.map(promo => {
      const promoProducts = getPromotionProducts(promo);
      const promoImages = promoProducts
        .map(item => item?.image?.url)
        .filter(Boolean) as string[];
      const fallbackImage = promoImages[0];
      const price = getPromotionPrice(promo);
      const originalPrice =
        typeof promo.originalPrice === "number" && promo.originalPrice > 0
          ? promo.originalPrice
          : promo.discount?.type === "percentage" && promo.discount.value > 0
            ? Math.round(price / (1 - promo.discount.value / 100))
            : undefined;

      return {
        _id: `promo-${promo._id}`,
        name: promo.name,
        price: price || 0,
        originalPrice,
        image: fallbackImage,
        images: promoImages,
        category: "Promocion",
        description: promo.description,
      } as AdProduct;
    });
  }, [promotions, getPromotionProducts]);

  // ───── Render ─────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Cargando productos…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-600">
          <p className="text-lg font-semibold">Error al cargar productos</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen bg-[#0b0f19] text-slate-100"
      style={{ fontFamily: "'Sora', 'Space Grotesk', ui-sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-[160px]" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[180px]" />
      </div>
      <div className="relative mx-auto max-w-7xl space-y-10 px-4 py-8">
        {/* ──── Header ──── */}
        <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="bg-linear-to-br rounded-3xl border border-white/10 from-slate-950 via-slate-900/90 to-slate-900/70 p-6 shadow-[0_20px_60px_-30px_rgba(2,6,23,0.7)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
              Auto-Ads activado
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              🎨 Generador de Publicidad
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              Diseña anuncios con estilo editorial y textos listos para vender.
              Exporta, comparte o copia con un clic.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                Posts listos en segundos
              </span>
              <span className="rounded-full border border-fuchsia-400/30 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                Copys de venta automaticos
              </span>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                Marca + logo integrados
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_16px_50px_-35px_rgba(2,6,23,0.7)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Panel creativo
            </p>
            <div className="mt-4 grid gap-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-400">Productos activos</p>
                  <p className="text-2xl font-semibold text-white">
                    {activeProducts.length}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Stock vivo
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-400">Promos listas</p>
                  <p className="text-2xl font-semibold text-white">
                    {promotions.length}
                  </p>
                </div>
                <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                  Auto-ofertas
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-400">Plantillas</p>
                  <p className="text-2xl font-semibold text-white">
                    {templatesToShow.length}
                  </p>
                </div>
                <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                  Estilos vivos
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ──── Sugerencias del Día ──── */}
        {suggestions.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_20px_60px_-45px_rgba(2,6,23,0.7)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                ✨ Sugerencias del Día
              </h2>
              <button
                onClick={refreshSuggestions}
                className="flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-200 transition hover:bg-fuchsia-500/25"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Nuevas ideas
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map(product => {
                const tpl =
                  TEMPLATES[
                    Math.abs(
                      product._id
                        .split("")
                        .reduce((a, c) => a + c.charCodeAt(0), 0)
                    ) % TEMPLATES.length
                  ];
                return (
                  <AdCard
                    key={`sug-${product._id}-${tpl}`}
                    product={product}
                    template={tpl}
                    logoUrl={logoUrl}
                    businessName={businessName}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ──── Promociones Activas ──── */}
        <section className="bg-linear-to-br rounded-3xl border border-white/10 from-slate-950 via-slate-900/90 to-slate-900/60 p-6 shadow-[0_20px_60px_-45px_rgba(2,6,23,0.7)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                📣 Promociones activas
              </h2>
              <p className="text-sm text-slate-300">
                Solo promociones activas con visibilidad pública.
              </p>
            </div>
            <button
              onClick={loadPromotions}
              className="rounded-full border border-cyan-400/30 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
            >
              Recargar
            </button>
          </div>

          {promotionsLoading && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
              Cargando promociones...
            </div>
          )}

          {!promotionsLoading && promotionsError && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-200">
              {promotionsError}
            </div>
          )}

          {!promotionsLoading && promotions.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {promoAds.map(promo => (
                <AdCard
                  key={promo._id}
                  product={promo}
                  template="promo"
                  logoUrl={logoUrl}
                  businessName={businessName}
                />
              ))}
            </div>
          )}
        </section>

        {/* ──── Filtros ──── */}
        <section>
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_12px_40px_-30px_rgba(2,6,23,0.7)] sm:flex-row sm:items-center">
            {/* Buscar */}
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Buscar producto…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900/70 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/40"
              />
            </div>

            {/* Selector de template */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">
                Estilo
              </label>
              <select
                value={selectedTemplate}
                onChange={e =>
                  setSelectedTemplate(e.target.value as TemplateType | "all")
                }
                className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-400/60 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/40"
              >
                <option value="all">Todos</option>
                {templateList.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Solo con imagen */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showOnlyWithImage}
                onChange={e => setShowOnlyWithImage(e.target.checked)}
                className="rounded border-white/10 text-fuchsia-400 focus:ring-fuchsia-400/40"
              />
              Con foto
            </label>
          </div>
        </section>

        {/* ──── Galería Completa ──── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            📸 Todos los Diseños ({filteredProducts.length} productos ×{" "}
            {templatesToShow.length} plantillas)
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/10 py-16 text-center text-slate-400">
              <p className="text-lg font-medium text-slate-200">
                No hay productos disponibles
              </p>
              <p className="mt-1 text-sm">
                Agrega productos a tu inventario para generar publicidad.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map(product =>
                templatesToShow.map(tpl => (
                  <AdCard
                    key={`${product._id}-${tpl}`}
                    product={product}
                    template={tpl}
                    logoUrl={logoUrl}
                    businessName={businessName}
                  />
                ))
              )}
            </div>
          )}

          {filteredProducts.length > visibleProducts.length && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setVisibleCount(c => c + 24)}
                className="rounded-lg bg-fuchsia-500/80 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-500"
              >
                Cargar mas
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
