/**
 * EmployeeAdvertisingPage — Publicidad para employees
 *
 * Dos apartados:
 * - Mis productos (stock del employee)
 * - Todos los productos (catalogo completo)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { useBrandLogo } from "../../../hooks/useBrandLogo";
import { useProducts } from "../../inventory/hooks/useProducts";
import { stockService } from "../../inventory/services/inventory.service";
import type {
  EmployeeStock,
  Product,
} from "../../inventory/types/product.types";
import AdCard from "../components/AdCard";
import type { AdProduct, TemplateType } from "../types/advertising.types";
import { templateList } from "../utils/templateThemes";

const TEMPLATES: TemplateType[] = templateList.map(t => t.id);

type TabType = "my-stock" | "all";

function toAdProductFromProduct(
  product: Product,
  priceOverride?: number
): AdProduct {
  const price =
    priceOverride ??
    product.clientPrice ??
    product.suggestedPrice ??
    product.employeePrice ??
    0;
  return {
    _id: product._id,
    name: product.name,
    price,
    originalPrice:
      product.suggestedPrice && product.suggestedPrice > price
        ? product.suggestedPrice
        : undefined,
    image: product.image?.url,
    category:
      typeof product.category === "object" && product.category !== null
        ? product.category.name
        : undefined,
    description: product.description,
  };
}

export default function EmployeeAdvertisingPage() {
  const { products, loading: allLoading, error: allError } = useProducts();
  const { business } = useBusiness();
  const logoUrl = useBrandLogo();

  const [tab, setTab] = useState<TabType>("my-stock");
  const [selectedTemplate, setSelectedTemplate] = useState<
    TemplateType | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [showOnlyWithImage, setShowOnlyWithImage] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  const [myStock, setMyStock] = useState<EmployeeStock[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);

  useEffect(() => {
    const loadMyStock = async () => {
      try {
        setMyLoading(true);
        setMyError(null);
        const response = await stockService.getEmployeeStock("me");
        setMyStock(response || []);
      } catch (err) {
        console.error("Error al cargar stock del employee:", err);
        setMyError("Error al cargar tu inventario");
      } finally {
        setMyLoading(false);
      }
    };

    loadMyStock();
  }, []);

  const myProducts = useMemo(() => {
    return myStock
      .filter(item => (item.quantity || 0) > 0)
      .map(item => {
        const product =
          typeof item.product === "object" ? (item.product as Product) : null;
        if (!product) return null;
        return toAdProductFromProduct(product, product.clientPrice);
      })
      .filter(Boolean) as AdProduct[];
  }, [myStock]);

  const allProducts = useMemo(() => {
    return products
      .filter(p => p.active !== false)
      .map(p => toAdProductFromProduct(p, p.clientPrice));
  }, [products]);

  const baseList = tab === "my-stock" ? myProducts : allProducts;

  const filteredProducts = useMemo(() => {
    let list = baseList;
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
  }, [baseList, search, showOnlyWithImage]);

  useEffect(() => {
    setVisibleCount(24);
  }, [search, showOnlyWithImage, selectedTemplate, tab]);

  const templatesToShow: TemplateType[] =
    selectedTemplate === "all" ? TEMPLATES : [selectedTemplate];

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const businessName = business?.name || "";

  const isLoading = tab === "my-stock" ? myLoading : allLoading;
  const error = tab === "my-stock" ? myError : allError;

  const refreshMyStock = useCallback(async () => {
    try {
      setMyLoading(true);
      setMyError(null);
      const response = await stockService.getEmployeeStock("me");
      setMyStock(response || []);
    } catch (err) {
      console.error("Error al cargar stock del employee:", err);
      setMyError("Error al cargar tu inventario");
    } finally {
      setMyLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 text-gray-100">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          🎨 Publicidad para Employees
        </h1>
        <p className="mt-1 text-gray-400">
          Genera posts con tus productos o con todo el catalogo.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setTab("my-stock")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "my-stock"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Mis productos en stock ({myProducts.length})
        </button>
        <button
          onClick={() => setTab("all")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "all"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Todos los productos ({allProducts.length})
        </button>
        {tab === "my-stock" && (
          <button
            onClick={refreshMyStock}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700"
          >
            Actualizar stock
          </button>
        )}
      </div>

      {/* Filtros */}
      <section>
        <div className="flex flex-col gap-4 rounded-xl border border-gray-700 bg-gray-900/40 p-4 shadow-sm sm:flex-row sm:items-center">
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
              className="w-full rounded-lg border border-gray-700 bg-gray-900/60 py-2 pl-10 pr-4 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-400">
              Estilo
            </label>
            <select
              value={selectedTemplate}
              onChange={e =>
                setSelectedTemplate(e.target.value as TemplateType | "all")
              }
              className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {templateList.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showOnlyWithImage}
              onChange={e => setShowOnlyWithImage(e.target.checked)}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Con foto
          </label>
        </div>
      </section>

      {/* Galeria */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          {tab === "my-stock"
            ? "Mis productos en stock"
            : "Todos los productos"}{" "}
          ({filteredProducts.length} productos × {templatesToShow.length}{" "}
          plantillas)
        </h2>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-700 bg-red-900/20 p-8 text-center text-red-300">
            {error}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-700 py-16 text-center text-gray-400">
            {tab === "my-stock"
              ? "No tienes productos con stock disponible"
              : "No hay productos disponibles"}
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
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Cargar mas
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
