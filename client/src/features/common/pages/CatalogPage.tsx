import { m as motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBusiness } from "../../../context/BusinessContext";
import {
  categoryService,
  productService,
} from "../../inventory/services/inventory.service";
// Footer y Navbar ocultos para vista pública del catálogo
import Footer from "../../../components/Footer";
import Navbar from "../../../components/Navbar";
import ProductCard from "../../../components/ProductCard";
import { useDebounce } from "../../../hooks";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { LoadingSpinner } from "../../../shared/components/ui";
import { exportCatalogToPDF } from "../../../utils/exportUtils";
import type { Category, Product } from "../../inventory/types/product.types";
import { promotionService } from "../../settings/services";
import type { Promotion } from "../../settings/types/promotion.types";

const sanitizeIdString = (raw: string): string => {
  const trimmed = String(raw || "").trim();
  if (
    !trimmed ||
    trimmed === "[object Object]" ||
    trimmed === "undefined" ||
    trimmed === "null"
  ) {
    return "";
  }

  const objectIdMatch = trimmed.match(/[a-fA-F0-9]{24}/);
  if (objectIdMatch) {
    return objectIdMatch[0].toLowerCase();
  }

  return trimmed;
};

const resolveEntityId = (value: unknown): string => {
  if (typeof value === "string") {
    return sanitizeIdString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
    oid?: unknown;
    toHexString?: () => string;
    toString?: () => string;
  };

  const fromToHex =
    typeof candidate.toHexString === "function"
      ? sanitizeIdString(candidate.toHexString())
      : "";

  const nested =
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    resolveEntityId(candidate.oid);

  if (fromToHex) {
    return fromToHex;
  }

  if (nested) {
    return nested;
  }

  if (typeof candidate.toString === "function") {
    return sanitizeIdString(candidate.toString());
  }

  return "";
};

const toStableListKey = (
  prefix: string,
  candidateId: unknown,
  index: number
): string => {
  const resolved = resolveEntityId(candidateId);
  return resolved ? `${prefix}-${resolved}` : `${prefix}-${index}`;
};

export default function Catalog() {
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isExportingCatalog, setIsExportingCatalog] = useState(false);
  const [catalogBranding, setCatalogBranding] = useState<{
    name?: string;
    logoUrl?: string | null;
  } | null>(null);
  const publicBusinessId = useMemo(() => {
    const fromQuery = searchParams.get("businessId");
    if (fromQuery) return fromQuery;
    if (typeof window !== "undefined") {
      const fromStorage = localStorage.getItem("businessId");
      if (fromStorage) return fromStorage;
    }
    return import.meta.env.VITE_PUBLIC_BUSINESS_ID || null;
  }, [searchParams]);
  const hideChrome = import.meta.env.PROD
    ? true
    : searchParams.has("bare") ||
      (searchParams.has("category") && !searchParams.has("full"));
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const [maxPrice, setMaxPrice] = useState(0);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(
    null
  );
  const productIndex = useMemo(
    () => new Map(products.map(product => [product._id, product])),
    [products]
  );

  useEffect(() => {
    setCatalogBranding(null);

    if (!publicBusinessId) {
      setLoadError(
        "Falta el businessId para cargar el catálogo público. Añade ?businessId=... o define VITE_PUBLIC_BUSINESS_ID en el build."
      );
      setLoading(false);
      return;
    }

    // Para visitas públicas, propaga el businessId al header mediante localStorage
    const hasToken = Boolean(localStorage.getItem("token"));
    if (publicBusinessId && !hasToken) {
      localStorage.setItem("businessId", publicBusinessId);
    }

    const loadData = async () => {
      try {
        // En modo público (sin token) las categorías están protegidas en la API;
        // derivamos categorías desde los productos para evitar 401.
        const productsResponse = hasToken
          ? await productService.getAll(
              publicBusinessId ? { businessId: publicBusinessId } : {}
            )
          : await productService.getPublicCatalog(
              publicBusinessId ? { businessId: publicBusinessId } : {}
            );
        const productsList = Array.isArray(productsResponse)
          ? productsResponse
          : productsResponse.data || [];
        const responseBranding =
          !Array.isArray(productsResponse) &&
          "business" in productsResponse &&
          productsResponse.business
            ? productsResponse.business
            : null;

        setCatalogBranding(responseBranding || null);

        const inStockProducts = productsList.filter(
          (product: Product) => (product.totalStock ?? 0) > 0
        );

        setProducts(inStockProducts);

        if (hasToken) {
          const categoriesData = await categoryService.getAll(
            publicBusinessId ? { businessId: publicBusinessId } : {}
          );
          setCategories(categoriesData);
        } else {
          const derivedCategories: Category[] = Array.from(
            new Map(
              productsList
                .map(p => p.category)
                .filter(Boolean)
                .map(cat => [cat._id, cat])
            ).values()
          );
          setCategories(derivedCategories);
        }

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
          console.error("Error loading promotions:", promoError);
          setPromotions([]);
          setPromotionError(
            hasToken ? "No se pudieron cargar promociones activas." : null
          );
        }

        const maxClientPrice = Math.max(
          0,
          ...inStockProducts.map((p: Product) => Number(p.clientPrice) || 0)
        );
        setMaxPrice(maxClientPrice || 0);
        setPriceRange({ min: 0, max: maxClientPrice || 0 });
      } catch (error) {
        console.error("Error loading data:", error);
        setLoadError(
          "No se pudieron cargar productos. Verifica businessId y acceso público."
        );
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [publicBusinessId]);

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

  const getPromotionProducts = (promo: Promotion) => {
    const promotionItems = Array.isArray((promo as any).items)
      ? (promo as any).items
      : [];

    if (promotionItems.length > 0) {
      return promotionItems
        .map((item: any) => {
          const itemProduct = item?.product ?? item;
          if (!itemProduct) return null;
          if (typeof itemProduct === "string") {
            return productIndex.get(itemProduct) || null;
          }
          const productId = itemProduct._id;
          if (!productId) return null;
          return productIndex.get(productId) || itemProduct;
        })
        .filter(Boolean);
    }

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
  };

  const selectedPromotionProducts = selectedPromotion
    ? getPromotionProducts(selectedPromotion)
    : [];

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(searchParams);
    if (publicBusinessId) {
      params.set("businessId", publicBusinessId);
    }
    const query = params.toString();
    return `${window.location.origin}/catalog${query ? `?${query}` : ""}`;
  }, [publicBusinessId, searchParams]);

  const shareText = "Explora nuestro catalogo y elige tus favoritos.";

  const shareTargets = useMemo(
    () => [
      {
        id: "whatsapp",
        label: "WhatsApp",
        href: `https://wa.me/?text=${encodeURIComponent(
          `${shareText}\n${shareLink}`
        )}`,
      },
      {
        id: "telegram",
        label: "Telegram",
        href: `https://t.me/share/url?url=${encodeURIComponent(
          shareLink
        )}&text=${encodeURIComponent(shareText)}`,
      },
      {
        id: "facebook",
        label: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          shareLink
        )}`,
      },
      {
        id: "x",
        label: "X",
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          shareText
        )}&url=${encodeURIComponent(shareLink)}`,
      },
      {
        id: "linkedin",
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          shareLink
        )}`,
      },
      {
        id: "email",
        label: "Correo",
        href: `mailto:?subject=${encodeURIComponent(
          "Catalogo de productos"
        )}&body=${encodeURIComponent(`${shareText}\n\n${shareLink}`)}`,
      },
    ],
    [shareLink]
  );

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

  const handleCopyShareLink = async () => {
    try {
      const copied = await copyToClipboard(shareLink);
      if (!copied) {
        throw new Error("copy_failed");
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      setShareError(null);
    } catch (_error) {
      window.prompt("Copia este enlace", shareLink);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopyShareLink();
      setShareError(
        "Tu navegador no soporta compartir. Copiamos el enlace para ti."
      );
      return;
    }

    try {
      await navigator.share({
        title: "Catalogo",
        text: shareText,
        url: shareLink,
      });
      setShareError(null);
    } catch (_error) {
      setShareError("No se pudo abrir el panel de compartir.");
    }
  };

  const resolveProductFlavor = (product: Product) => {
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
          businessName:
            catalogBranding?.name?.trim() || business?.name || "Essence ERP",
          logoUrl:
            catalogBranding?.logoUrl?.trim() ||
            business?.logoUrl?.trim() ||
            brandLogo,
          title: "Catalogo de Venta",
        }
      );
    } catch (error) {
      console.error("Error exporting catalog PDF", error);
      window.alert("No se pudo generar el catálogo PDF.");
    } finally {
      setIsExportingCatalog(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search term
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => {
        const categoryId =
          typeof p.category === "object" ? p.category?._id : p.category;
        return categoryId === selectedCategory;
      });
    }

    if (inStockOnly) {
      filtered = filtered.filter(p => (p.totalStock ?? 0) > 0);
    }

    if (featuredOnly) {
      filtered = filtered.filter(p => p.featured);
    }

    filtered = filtered.filter(p => {
      const price = Number(p.clientPrice) || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    // Sort products
    switch (sortBy) {
      case "price-asc":
        filtered.sort((a, b) => (a.clientPrice || 0) - (b.clientPrice || 0));
        break;
      case "price-desc":
        filtered.sort((a, b) => (b.clientPrice || 0) - (a.clientPrice || 0));
        break;
      case "name":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "featured":
        filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return filtered;
  }, [
    products,
    debouncedSearchTerm,
    selectedCategory,
    sortBy,
    inStockOnly,
    featuredOnly,
    priceRange,
  ]);

  useEffect(() => {
    // Update URL params
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

  return (
    <div
      className="min-h-screen bg-[#0f1210] text-slate-100"
      style={{ fontFamily: "'Poppins', 'Montserrat', sans-serif" }}
    >
      {!hideChrome && (
        <Navbar logoUrlOverride={catalogBranding?.logoUrl || undefined} />
      )}

      {!hideChrome && (
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(245,158,11,0.28),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.2),transparent_40%)]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-emerald-100 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                  </span>
                  Catalogo inteligente
                </div>

                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Eleva tu selección con filtros inteligentes y vista inmersiva.
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
                  Busca, filtra y explora productos premium con una experiencia
                  visual más cuidada. Haz foco en lo destacado, stock disponible
                  y precios al instante.
                </p>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100">
                    Filtros dinamicos
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Vistas grid/lista
                  </div>
                  <div className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100">
                    Precios en vivo
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
                    <span>Categorias</span>
                    <span className="font-semibold text-white">
                      {categories.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Destacados</span>
                    <span className="font-semibold text-white">
                      {products.filter(p => p.featured).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>Stock disponible</span>
                    <span className="font-semibold text-emerald-300">
                      {products.filter(p => (p.totalStock ?? 0) > 0).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`mx-auto max-w-7xl space-y-6 px-4 ${hideChrome ? "py-6" : "py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"}`}
      >
        {loadError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </div>
        )}

        <div className="bg-linear-to-br rounded-2xl border border-white/10 from-white/10 via-white/5 to-white/0 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Compartir catalogo
              </p>
              <p className="text-xs text-gray-400">
                Comparte con un clic o publica en cualquier red social.
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
                onClick={handleExportCatalog}
                disabled={
                  isExportingCatalog || loading || filteredProducts.length === 0
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
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78.165-.398.142-.854-.108-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="truncate">{shareLink}</span>
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

        {/* Active Promotions */}
        {(promotionError || activePromotions.length > 0) && (
          <section className="bg-linear-to-br rounded-3xl border border-emerald-400/20 from-emerald-500/10 via-transparent to-amber-500/10 p-6 shadow-xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Promociones activas
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  Ahorra con ofertas listas para hoy
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
                {activePromotions.map((promo, promoIndex) => {
                  const promoKey = toStableListKey(
                    "catalog-promo",
                    promo?._id,
                    promoIndex
                  );
                  const price = getPromotionPrice(promo);
                  const discountLabel = getPromotionDiscountLabel(promo, price);
                  const promoProducts = getPromotionProducts(promo);
                  const collageImages = promoProducts
                    .map(product => product.image?.url)
                    .filter(Boolean)
                    .slice(0, 4) as string[];

                  const collageGridClass =
                    collageImages.length <= 1 ? "grid-cols-1" : "grid-cols-2";

                  const collageHeightClass =
                    collageImages.length <= 1 ? "h-32" : "h-16";

                  return (
                    <div
                      key={promoKey}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-gray-950/60 p-5 shadow-lg transition hover:-translate-y-1 hover:border-emerald-400/40"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPromotion(promo)}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedPromotion(promo);
                        }
                      }}
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
                      {promoProducts.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className={`grid gap-2 ${collageGridClass}`}>
                            {collageImages.length > 0 ? (
                              collageImages.map((imageUrl, index) => (
                                <div
                                  key={`${promoKey}-collage-${index}`}
                                  className={`overflow-hidden rounded-xl border border-white/10 bg-white/5 ${collageHeightClass}`}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`Producto ${index + 1} de ${promo.name}`}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="col-span-2 flex h-20 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-gray-400">
                                Sin imagenes disponibles
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            Incluye {promoProducts.length} producto(s)
                          </div>
                          {promoProducts.length > 4 && (
                            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white">
                              +{promoProducts.length - 4} mas
                            </span>
                          )}
                        </div>
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

        {/* Category Pills */}
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
              Todos
            </button>
            {categories.map((cat, index) => (
              <button
                key={toStableListKey("catalog-category", cat?._id, index)}
                onClick={() => setSelectedCategory(cat._id)}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base ${
                  selectedCategory === cat._id
                    ? "bg-linear-to-r scale-105 from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/40"
                    : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Controls */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr] lg:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full rounded-xl border border-white/10 bg-gray-900/70 px-11 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-white/10 bg-gray-900/70 px-4 py-3 text-sm text-white transition hover:border-amber-400 focus:border-amber-400 focus:outline-none"
            >
              <option value="name">Ordenar: A-Z</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="featured">Destacados primero</option>
            </select>

            <div className="flex rounded-xl border border-white/10 bg-gray-900/60 p-1.5">
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200 transition hover:border-emerald-400/50">
              <div>
                <p className="font-semibold text-white">Solo con stock</p>
                <p className="text-xs text-gray-400">
                  Oculta productos agotados
                </p>
              </div>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-gray-900/60 px-4 py-3 text-sm text-gray-200 transition hover:border-amber-400/50">
              <div>
                <p className="font-semibold text-white">Solo destacados</p>
                <p className="text-xs text-gray-400">Prioriza lo que brilla</p>
              </div>
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
                  <p className="text-xs text-gray-400">Cliente</p>
                </div>
                <span className="text-xs text-gray-400">
                  Max {maxPrice ? maxPrice.toLocaleString() : 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1">
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
                    className="w-full rounded-md border border-white/10 bg-gray-800/80 px-2 py-1 text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <span className="text-gray-500">-</span>
                <div className="flex-1">
                  <input
                    type="number"
                    min={priceRange.min}
                    max={maxPrice || undefined}
                    value={priceRange.max}
                    onChange={e =>
                      setPriceRange(prev => ({
                        ...prev,
                        max: Number(e.target.value) || maxPrice,
                      }))
                    }
                    className="w-full rounded-md border border-white/10 bg-gray-800/80 px-2 py-1 text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-400 sm:text-base">
              {filteredProducts.length > 0 ? (
                <>
                  <span className="font-semibold text-white">
                    {filteredProducts.length}
                  </span>{" "}
                  producto{filteredProducts.length !== 1 ? "s" : ""} encontrado
                  {filteredProducts.length !== 1 ? "s" : ""}
                </>
              ) : (
                "No se encontraron productos"
              )}
            </p>
            {(searchTerm ||
              selectedCategory !== "all" ||
              sortBy !== "name") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSortBy("name");
                  setInStockOnly(false);
                  setFeaturedOnly(false);
                  setPriceRange({ min: 0, max: maxPrice });
                }}
                className="flex items-center gap-1.5 text-sm text-amber-300 transition-colors hover:text-amber-200"
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
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Products Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" message="Cargando productos..." />
          </div>
        ) : filteredProducts.length > 0 ? (
          <motion.div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-4"
            }
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {filteredProducts.map((product, index) => (
              <motion.div
                key={toStableListKey("catalog-product", product?._id, index)}
                variants={staggerItem}
              >
                <ProductCard product={product} viewMode={viewMode} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full border border-white/10 bg-white/5 p-6">
              <svg
                className="h-16 w-16 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">
              No encontramos productos
            </h3>
            <p className="mb-6 text-gray-400">
              Intenta ajustar tus filtros de búsqueda
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSortBy("name");
                setInStockOnly(false);
                setFeaturedOnly(false);
                setPriceRange({ min: 0, max: maxPrice });
              }}
              className="bg-linear-to-r rounded-xl from-amber-500 to-orange-500 px-6 py-3 font-medium text-white transition-all hover:shadow-lg hover:shadow-amber-500/40"
            >
              Ver todos los productos
            </button>
          </div>
        )}
      </div>

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

      {selectedPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            onClick={() => setSelectedPromotion(null)}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar detalle de promocion"
          />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-gray-950/95 p-6 text-left shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedPromotion(null)}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white"
            >
              Cerrar
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase text-emerald-200">
                {selectedPromotion.type}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white">
                Promocion activa
              </span>
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {selectedPromotion.name}
            </h3>
            {selectedPromotion.description && (
              <p className="mt-2 text-sm text-gray-300">
                {selectedPromotion.description}
              </p>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr,1.1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Productos incluidos
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selectedPromotionProducts.length > 0 ? (
                    selectedPromotionProducts
                      .slice(0, 6)
                      .map((product, index) => (
                        <div
                          key={toStableListKey(
                            "catalog-promo-product",
                            product?._id,
                            index
                          )}
                          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-2"
                        >
                          {product.image?.url ? (
                            <img
                              src={product.image.url}
                              alt={product.name}
                              className="h-10 w-10 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-white/10" />
                          )}
                          <span className="text-xs font-semibold text-white">
                            {product.name}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="text-xs text-gray-400">
                      No hay productos asociados a esta promocion.
                    </p>
                  )}
                </div>
                {selectedPromotionProducts.length > 6 && (
                  <p className="mt-2 text-xs text-gray-400">
                    +{selectedPromotionProducts.length - 6} productos mas
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Collage
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selectedPromotionProducts
                    .slice(0, 4)
                    .map((product, index) => (
                      <div
                        key={toStableListKey(
                          "catalog-promo-collage-product",
                          product?._id,
                          index
                        )}
                        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                      >
                        {product.image?.url ? (
                          <img
                            src={product.image.url}
                            alt={product.name}
                            className="h-32 w-full bg-white/5 object-contain p-2"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-32 items-center justify-center text-xs text-gray-400">
                            Sin imagen
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-400">Precio promocional</p>
                <p className="text-lg font-semibold text-white">
                  {getPromotionPrice(selectedPromotion).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Descuento</p>
                <p className="text-lg font-semibold text-emerald-200">
                  {getPromotionDiscountLabel(
                    selectedPromotion,
                    getPromotionPrice(selectedPromotion)
                  ) || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Productos</p>
                <p className="text-lg font-semibold text-white">
                  {selectedPromotionProducts.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hideChrome && (
        <Footer logoUrlOverride={catalogBranding?.logoUrl || undefined} />
      )}
    </div>
  );
}
