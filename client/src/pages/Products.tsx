import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categoryService, productService } from "../api/services.ts";
import LoadingSpinner from "../components/LoadingSpinner";
import type { Category, Product } from "../types";
import {
  buildCacheKey,
  readSessionCache,
  writeSessionCache,
} from "../utils/requestCache";

const PRODUCTS_CACHE_TTL_MS = 60 * 1000;
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

export default function Products() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, categoryFilter]);

  const loadData = async () => {
    try {
      const filters: Record<string, string | boolean | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (categoryFilter) filters.category = categoryFilter;

      const productsKey = buildCacheKey("products:list", filters);
      const categoriesKey = buildCacheKey("categories:list");

      const cachedProducts = readSessionCache<{
        data: Product[];
        pagination?: typeof pagination;
      }>(productsKey, PRODUCTS_CACHE_TTL_MS);
      const cachedCategories = readSessionCache<Category[]>(
        categoriesKey,
        CATEGORIES_CACHE_TTL_MS
      );

      if (cachedCategories?.length) setCategories(cachedCategories);
      if (cachedProducts?.data?.length) {
        setProducts(cachedProducts.data);
        if (cachedProducts.pagination) setPagination(cachedProducts.pagination);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const [productsData, categoriesData] = await Promise.all([
        productService.getAll(filters),
        cachedCategories?.length
          ? Promise.resolve(cachedCategories)
          : categoryService.getAll(),
      ]);

      setProducts(productsData.data);
      if (productsData.pagination) {
        setPagination(productsData.pagination);
      }
      setCategories(categoriesData);

      writeSessionCache(productsKey, {
        data: productsData.data,
        pagination: productsData.pagination,
      });
      writeSessionCache(categoriesKey, categoriesData);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al cargar los datos";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el producto "${name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await productService.delete(id);
      await loadData();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo eliminar el producto";
      setError(message);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesSearch;
  });

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Productos
          </h1>
          <p className="mt-1 text-sm text-gray-400 sm:mt-2 sm:text-base">
            Gestiona el catálogo de Essence. Puedes agregar, editar o eliminar
            productos en cualquier momento.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/add-product")}
          className="bg-linear-to-r inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg from-purple-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 active:scale-[0.98] sm:px-5 sm:text-base md:w-auto"
        >
          <span className="text-xl leading-none sm:text-2xl">＋</span>
          Nuevo producto
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por nombre..."
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
        />

        <select
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2.5 text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
        >
          <option value="">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setSearch("");
            setCategoryFilter("");
          }}
          className="min-h-[44px] rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white active:scale-95 sm:px-4 sm:py-3 sm:text-base"
        >
          Limpiar filtros
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center sm:h-96">
          <LoadingSpinner size="lg" message="Cargando productos..." />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-sm text-gray-400 sm:rounded-xl sm:p-12 sm:text-base">
          No se encontraron productos con los filtros actuales.
        </div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="grid gap-4 sm:gap-6 md:hidden">
            {filteredProducts.map(product => (
              <div
                key={product._id}
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition hover:border-purple-500"
              >
                <div className="flex gap-4">
                  {product.image?.url ? (
                    <img
                      src={product.image.url}
                      alt={product.name}
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-600 text-xs text-gray-500">
                      N/A
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {typeof product.category === "string"
                        ? product.category
                        : product.category.name}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-lg font-bold text-purple-400">
                        ${product.clientPrice?.toFixed(2) || "0.00"}
                      </p>
                      <p className="text-sm text-gray-400">
                        Stock: {product.totalStock || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      navigate(`/admin/products/${product._id}/edit`)
                    }
                    className="min-h-[44px] flex-1 rounded-lg border border-purple-500/60 px-3 py-2 text-xs font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(product._id, product.name)}
                    className="min-h-[44px] flex-1 rounded-lg border border-red-500/60 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-600/20 active:scale-95"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación Vista Móvil */}
          {pagination.pages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-4 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-4 md:hidden">
              <div className="text-center text-sm text-gray-400">
                Página {pagination.page} de {pagination.pages}
                <br />
                Total: {pagination.total} productos
              </div>
              <div className="flex w-full gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="min-h-[44px] flex-1 rounded-lg border border-purple-500/60 px-4 py-3 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                  className="min-h-[44px] flex-1 rounded-lg border border-purple-500/60 px-4 py-3 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                      Producto
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                      Categoría
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                      Precio
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider text-gray-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredProducts.map(product => (
                    <tr
                      key={product._id}
                      className="transition hover:bg-gray-900/60"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {product.image?.url ? (
                            <img
                              src={product.image.url}
                              alt={product.name}
                              className="h-14 w-14 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-600 text-gray-500">
                              N/A
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white">
                              {product.name}
                            </p>
                            <p className="max-w-xs truncate text-sm text-gray-400">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {typeof product.category === "string"
                          ? product.category
                          : product.category.name}
                      </td>
                      <td className="px-6 py-4 font-semibold text-purple-400">
                        ${product.clientPrice?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {product.totalStock || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() =>
                              navigate(`/admin/products/${product._id}/edit`)
                            }
                            className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(product._id, product.name)
                            }
                            className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600/20 active:scale-95"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Controles de Paginación */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800/50 px-6 py-4 sm:flex-row">
                <div className="text-sm text-gray-400">
                  Página {pagination.page} de {pagination.pages} • Total:{" "}
                  {pagination.total} productos
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
