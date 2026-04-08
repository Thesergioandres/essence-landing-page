import { m as motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";
import ProductCard from "../../../components/ProductCard";
import { useBusiness } from "../../../context/BusinessContext";
import { useDebounce } from "../../../hooks";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { LoadingSpinner } from "../../../shared/components/ui";
import { exportCatalogToPDF } from "../../../utils/exportUtils";
import { productService } from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";
import { promotionService } from "../../settings/services";
import type { Promotion } from "../../settings/types/promotion.types";

interface ProductWithStock extends Product {
  distributorStock?: number;
}

export default function DistributorCatalog() {
  const { business } = useBusiness();
  const brandLogo = useBrandLogo();

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 26,
      },
    },
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicCatalogUrl, setPublicCatalogUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isExportingCatalog, setIsExportingCatalog] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const [maxPrice, setMaxPrice] = useState(0);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const navigate = useNavigate();
  const hideChrome = useMemo(
    () =>
      searchParams.has("bare") ||
      (searchParams.has("category") && !searchParams.has("full")),
    [searchParams]
  );

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await productService
          .getDistributorProducts()
          .catch(() => []);
        const productsList = Array.isArray(response)
          ? response
          : response?.data || [];

        const normalizedProducts = (productsList || []).map(
          (product: ProductWithStock) => ({
            ...product,
            totalStock: product.distributorStock ?? product.totalStock ?? 0,
          })
        );

        setProducts(normalizedProducts);

        const maxClientPrice = Math.max(
          0,
          ...normalizedProducts.map(
            (p: ProductWithStock) => Number(p.clientPrice) || 0
          )
        );
        setMaxPrice(maxClientPrice || 0);
        setPriceRange({ min: 0, max: maxClientPrice || 0 });

        const uniqueCategories = Array.from(
          new Set(
            (normalizedProducts || []).map((p: ProductWithStock) =>
              typeof p.category === "string" ? p.category : p.category.name
            )
          )
        );
        setCategories(uniqueCategories as string[]);

        try {
          const promoResponse = await promotionService.getAll({
            status: "active",
          });
          const promoList = (promoResponse.promotions || []).filter(
            promo => promo.showInCatalog !== false
          );
          setPromotions(promoList);
          setPromotionError(null);
        } catch (promoError) {
          console.error("Error al cargar promociones:", promoError);
          setPromotions([]);
          setPromotionError("No se pudieron cargar promociones activas.");
        }
      } catch (error) {
        console.error("Error al cargar productos:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const activePromotions = useMemo(() => {
    return (promotions || []).filter(
      promo => promo.status === "active" || promo.isActive
    );
  }, [promotions]);

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

  const getPromotionDiscountLabel = (promo: Promotion, price: number) => {
    const discountType =
      promo.discount?.type ||
      (promo.type === "percentage"
        ? "percentage"
        : promo.type === "fixed"
          ? "amount"
          : null);
    const rawDiscountValue =
      typeof promo.discount?.value === "number"
        ? promo.discount.value
        : typeof promo.value === "number"
          ? promo.value
          : null;

    if (discountType && typeof rawDiscountValue === "number") {
      if (discountType === "percentage" && rawDiscountValue > 0) {
        return `-${rawDiscountValue}%`;
      }
      if (discountType === "amount" && rawDiscountValue > 0) {
        return `-$${rawDiscountValue}`;
      }
    }

    const savingsPct = Number(promo.savingsPercentage || 0);
    if (savingsPct > 0) return `-${Math.round(savingsPct)}%`;

    const savings = Number(promo.savings || 0);
    if (savings > 0) return `-$${Math.round(savings)}`;

    const originalPrice = Number(promo.originalPrice || 0);
    if (originalPrice > 0 && price > 0 && originalPrice > price) {
      const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
      if (pct > 0) return `-${pct}%`;
    }

    return null;
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user?._id) {
      setPublicCatalogUrl(
        `${window.location.origin}/distributor-catalog/${user._id}`
      );
    }
  }, []);

  const shareText = "Te comparto mi catalogo de productos.";

  const shareTargets = useMemo(
    () => [
      {
        id: "whatsapp",
        label: "WhatsApp",
        href: `https://wa.me/?text=${encodeURIComponent(
          `${shareText}\n${publicCatalogUrl}`
        )}`,
      },
      {
        id: "telegram",
        label: "Telegram",
        href: `https://t.me/share/url?url=${encodeURIComponent(
          publicCatalogUrl
        )}&text=${encodeURIComponent(shareText)}`,
      },
      {
        id: "facebook",
        label: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          publicCatalogUrl
        )}`,
      },
      {
        id: "x",
        label: "X",
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          shareText
        )}&url=${encodeURIComponent(publicCatalogUrl)}`,
      },
      {
        id: "linkedin",
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          publicCatalogUrl
        )}`,
      },
      {
        id: "email",
        label: "Correo",
        href: `mailto:?subject=${encodeURIComponent(
          "Catalogo de productos"
        )}&body=${encodeURIComponent(`${shareText}\n\n${publicCatalogUrl}`)}`,
      },
    ],
    [publicCatalogUrl]
  );

  const handleCopyShareLink = async () => {
    if (!publicCatalogUrl) return;
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

      const copied = await copyToClipboard(publicCatalogUrl);
      if (!copied) {
        throw new Error("copy_failed");
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      setShareError(null);
    } catch (_error) {
      window.prompt("Copia este enlace", publicCatalogUrl);
    }
  };

  const handleNativeShare = async () => {
    if (!publicCatalogUrl) return;
    if (!navigator.share) {
      handleCopyShareLink();
      setShareError(
        "Tu navegador no soporta compartir. Copiamos el enlace para ti."
      );
      return;
    }

    try {
      await navigator.share({
        title: "Catalogo de distribuidor",
        text: shareText,
        url: publicCatalogUrl,
      });
      setShareError(null);
    } catch (_error) {
      setShareError("No se pudo abrir el panel de compartir.");
    }
  };

  const resolveProductFlavor = (product: ProductWithStock) => {
    const candidate =
      ((product as any)?.flavor as string | undefined) ||
      ((product as any)?.sabor as string | undefined) ||
      ((product as any)?.variant as string | undefined) ||
      null;

    return candidate?.trim() || null;
  };

  const handleExportCatalog = async () => {
    if (loading || filteredProducts.length === 0) {
      window.alert("No hay productos visibles para exportar en el catálogo.");
      return;
    }

    setIsExportingCatalog(true);
    try {
      await exportCatalogToPDF(
        filteredProducts.map(product => ({
          name: product.name,
          flavor: resolveProductFlavor(product),
          description: product.description || "",
          clientPrice: Number(product.clientPrice || 0),
          image: product.image?.url || null,
        })),
        {
          businessName: business?.name || "Catalogo de distribuidor",
          logoUrl: business?.logoUrl?.trim() || brandLogo,
          title: "Catalogo de Venta",
        }
      );
    } catch (error) {
      console.error("Error exporting distributor catalog PDF", error);
      window.alert("No se pudo generar el catálogo PDF.");
    } finally {
      setIsExportingCatalog(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== "all") {
      list = list.filter(p => {
        const categoryName =
          typeof p.category === "string" ? p.category : p.category.name;
        return categoryName === selectedCategory;
      });
    }

    if (inStockOnly) {
      list = list.filter(p => (p.distributorStock ?? 0) > 0);
    }

    if (featuredOnly) {
      list = list.filter(p => p.featured);
    }

    list = list.filter(p => {
      const price = Number(p.clientPrice) || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    switch (sortBy) {
      case "price-asc":
        list.sort((a, b) => (a.clientPrice || 0) - (b.clientPrice || 0));
        break;
      case "price-desc":
        list.sort((a, b) => (b.clientPrice || 0) - (a.clientPrice || 0));
        break;
      case "stock":
        list.sort(
          (a, b) => (b.distributorStock || 0) - (a.distributorStock || 0)
        );
        break;
      case "featured":
        list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [
    products,
    debouncedSearchTerm,
    selectedCategory,
    inStockOnly,
    featuredOnly,
    priceRange,
    sortBy,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (sortBy !== "name") params.set("sort", sortBy);
    if (inStockOnly) params.set("stock", "1");
    if (featuredOnly) params.set("featured", "1");
    if (priceRange.min) params.set("min", String(priceRange.min));
    if (priceRange.max && priceRange.max !== maxPrice)
      params.set("max", String(priceRange.max));
    setSearchParams(params, { replace: true });
  }, [
    searchTerm,
    selectedCategory,
    sortBy,
    inStockOnly,
    featuredOnly,
    priceRange,
    maxPrice,
    setSearchParams,
  ]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando catálogo..." />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0f1210] text-slate-100"
      style={{ fontFamily: "'Poppins', 'Montserrat', sans-serif" }}
    >
      {!hideChrome && <Navbar />}

      {!hideChrome && (
        <header className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(245,158,11,0.28),transparent_35%),radial-gradient(circle_at_40%_80%,rgba(14,165,233,0.2),transparent_40%)]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-emerald-100 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                  </span>
                  Catálogo del distribuidor
                </div>

                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Productos asignados, listos para vender.
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
                  Busca, filtra y prioriza lo que tienes en stock. Ordena por
                  precio o inventario y comparte tu catálogo con un clic.
                </p>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100">
                    Filtros rapidos
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Vista grid/lista
                  </div>
                  <div className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100">
                    Stock y precio
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      Productos en catálogo
                    </p>
                    <p className="text-4xl font-bold text-white">
                      {products.length}
                    </p>
                  </div>
                  <div className="bg-linear-to-r rounded-full from-amber-500 to-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                    Actualizado
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Categorías</span>
                    <span className="font-semibold text-white">
                      {categories.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Con stock</span>
                    <span className="font-semibold text-emerald-300">
                      {
                        products.filter(p => (p.distributorStock ?? 0) > 0)
                          .length
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Valor máx. cliente</span>
                    <span className="font-semibold text-white">
                      {maxPrice ? maxPrice.toLocaleString() : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto max-w-7xl space-y-6 px-4 ${hideChrome ? "py-6" : "py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"}`}
      >
        {publicCatalogUrl && (
          <div className="bg-linear-to-br rounded-2xl border border-white/10 from-white/10 via-white/5 to-white/0 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Comparte tu catalogo
                </p>
                <p className="text-xs text-gray-400">
                  Publica tu inventario y envia el enlace a tus clientes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleNativeShare}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400"
                >
                  Compartir ahora
                </button>
                <button
                  onClick={handleCopyShareLink}
                  className="rounded-lg border border-white/10 bg-gray-950/60 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:bg-white/10"
                >
                  {copiedLink ? "Copiado" : "Copiar link"}
                </button>
                <button
                  onClick={() => navigate("/distributor/share-catalog")}
                  className="rounded-lg border border-white/10 bg-gray-950/60 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:bg-white/10"
                >
                  Ver opciones
                </button>
                <button
                  onClick={handleExportCatalog}
                  disabled={
                    isExportingCatalog ||
                    loading ||
                    filteredProducts.length === 0
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
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
                      d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 1v4h4"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6M9 17h6"
                    />
                  </svg>
                  {isExportingCatalog ? "Generando PDF..." : "Descargar PDF"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[2fr,1fr]">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-gray-950/60 px-3 py-2 text-xs text-gray-300">
                <span className="truncate">{publicCatalogUrl}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shareTargets.map(target => (
                  <a
                    key={target.id}
                    href={target.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/10 bg-gray-950/60 px-3 py-2 text-xs font-semibold text-gray-100 transition hover:bg-white/10"
                  >
                    {target.label}
                  </a>
                ))}
              </div>
            </div>

            {(copiedLink || shareError) && (
              <div className="mt-3 text-xs text-gray-400">
                {copiedLink ? "Enlace copiado." : shareError}
              </div>
            )}
          </div>
        )}

        {(promotionError || activePromotions.length > 0) && (
          <section className="bg-linear-to-br rounded-3xl border border-emerald-400/20 from-emerald-500/10 via-transparent to-amber-500/10 p-6 shadow-xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Promociones activas
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  Ofertas para clientes finales
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100">
                {activePromotions.length} disponibles
              </span>
            </div>

            {promotionError ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {promotionError}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activePromotions.map(promo => {
                  const price = getPromotionPrice(promo);
                  const discountLabel = getPromotionDiscountLabel(promo, price);
                  return (
                    <div
                      key={promo._id}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-gray-950/60 p-5 shadow-lg transition hover:-translate-y-1 hover:border-emerald-400/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                            {promo.type === "combo"
                              ? "Combo"
                              : promo.type === "percentage"
                                ? "Descuento"
                                : "Promo"}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            {promo.name}
                          </h3>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold uppercase text-emerald-100">
                          Activa
                        </span>
                      </div>
                      {promo.description && (
                        <p className="mt-3 line-clamp-2 text-sm text-gray-300">
                          {promo.description}
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400">
                            Precio cliente
                          </p>
                          <p className="text-2xl font-semibold text-emerald-200">
                            ${price.toFixed(0)}
                          </p>
                        </div>
                        {discountLabel && (
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                            {discountLabel}
                          </span>
                        )}
                      </div>
                      {promo.comboItems && promo.comboItems.length > 0 && (
                        <p className="mt-3 text-xs text-gray-400">
                          Incluye {promo.comboItems.length} producto(s)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        <div className="scrollbar-hide mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-2 sm:gap-3">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                selectedCategory === "all"
                  ? "bg-linear-to-r scale-105 from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/40"
                  : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                  selectedCategory === cat
                    ? "bg-linear-to-r scale-105 from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/40"
                    : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-lg sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar productos por nombre o descripción"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/60 px-4 py-3 pl-12 text-white placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
                <svg
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
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
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full lg:w-56">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gray-900/60 px-4 py-3 text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <option value="name">Ordenar: A-Z</option>
                <option value="price-asc">Precio: Menor a mayor</option>
                <option value="price-desc">Precio: Mayor a menor</option>
                <option value="stock">Stock: Mayor a menor</option>
                <option value="featured">Destacados primero</option>
              </select>
            </div>

            <div className="flex w-fit gap-2 rounded-xl border border-white/10 bg-gray-900/70 p-1.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2.5 transition-all ${
                  viewMode === "grid"
                    ? "bg-amber-500 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2.5 transition-all ${
                  viewMode === "list"
                    ? "bg-amber-500 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <span className="flex flex-col">
                <span className="font-semibold text-white">Solo con stock</span>
                <span className="text-xs text-gray-400">
                  Oculta asignaciones agotadas
                </span>
              </span>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <span className="flex flex-col">
                <span className="font-semibold text-white">
                  Solo destacados
                </span>
                <span className="text-xs text-gray-400">
                  Prioriza productos destacados
                </span>
              </span>
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={e => setFeaturedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
            </label>

            <div className="rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Rango de precio</p>
                  <p className="text-xs text-gray-400">Precio cliente</p>
                </div>
                <span className="text-xs text-gray-400">
                  Max {maxPrice ? maxPrice.toLocaleString() : 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="number"
                  min={0}
                  max={priceRange.max}
                  value={priceRange.min}
                  onChange={e =>
                    setPriceRange(prev => ({
                      ...prev,
                      min: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-1/2 rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  placeholder="Mín"
                />
                <input
                  type="number"
                  min={priceRange.min}
                  max={maxPrice || undefined}
                  value={priceRange.max}
                  onChange={e =>
                    setPriceRange(prev => ({
                      ...prev,
                      max: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-1/2 rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  placeholder="Máx"
                />
              </div>
            </div>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
            <svg
              className="mb-4 h-10 w-10 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-6 4h6M5 7h.01M19 7h.01M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"
              />
            </svg>
            <p className="text-xl font-semibold text-white">Sin resultados</p>
            <p className="mt-2 text-sm text-gray-400">
              Ajusta los filtros o busca por otro término.
            </p>
          </div>
        ) : (
          <motion.div
            className={`grid gap-6 ${
              viewMode === "grid"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            }`}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {filteredProducts.map(product => (
              <motion.div key={product._id} variants={staggerItem}>
                <ProductCard
                  product={product}
                  viewMode={viewMode}
                  showDistributorPrice={false}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      <button
        type="button"
        onClick={handleExportCatalog}
        disabled={
          isExportingCatalog || loading || filteredProducts.length === 0
        }
        className="fixed bottom-5 right-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/30 backdrop-blur-sm transition hover:scale-[1.02] hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 1v4h4"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6M9 17h6"
          />
        </svg>
        <span className="hidden sm:inline">
          {isExportingCatalog ? "Generando PDF..." : "Catalogo PDF"}
        </span>
        <span className="sm:hidden">PDF</span>
      </button>

      {!hideChrome && <Footer />}
    </div>
  );
}
