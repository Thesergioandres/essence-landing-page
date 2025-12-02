import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categoryService, productService } from "../api/services.ts";
import type { Category, Product } from "../types";

export default function Products() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  useEffect(() => {
    void loadData();
  }, [pagination.page, categoryFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const filters: Record<string, string | boolean | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (categoryFilter) filters.category = categoryFilter;

      const [productsData, categoriesData] = await Promise.all([
        productService.getAll(filters),
        categoryService.getAll(),
      ]);
      
      setProducts(productsData.data);
      if (productsData.pagination) {
        setPagination(productsData.pagination);
      }
      setCategories(categoriesData);
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
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Productos</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-400">
            Gestiona el catálogo de Essence. Puedes agregar, editar o eliminar
            productos en cualquier momento.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/add-product")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 sm:px-5 py-3 text-sm sm:text-base font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 active:scale-[0.98] min-h-[48px] w-full md:w-auto"
        >
          <span className="text-xl sm:text-2xl leading-none">＋</span>
          Nuevo producto
        </button>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por nombre..."
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        <select
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white active:scale-95 min-h-[44px]"
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
        <div className="flex h-64 sm:h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/50 p-8 sm:p-12 text-center text-sm sm:text-base text-gray-400">
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
                      className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-600 text-xs text-gray-500">
                      N/A
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {typeof product.category === "string"
                        ? product.category
                        : product.category.name}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-lg font-bold text-purple-400">
                        ${product.clientPrice?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-sm text-gray-400">Stock: {product.totalStock || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigate(`/admin/products/${product._id}/edit`)}
                    className="flex-1 rounded-lg border border-purple-500/60 px-3 py-2 text-xs font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 min-h-[44px]"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(product._id, product.name)}
                    className="flex-1 rounded-lg border border-red-500/60 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-600/20 active:scale-95 min-h-[44px]"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación Vista Móvil */}
          {pagination.pages > 1 && (
            <div className="md:hidden mt-6 flex flex-col items-center gap-4 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-4">
              <div className="text-sm text-gray-400 text-center">
                Página {pagination.page} de {pagination.pages}
                <br />
                Total: {pagination.total} productos
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="flex-1 rounded-lg border border-purple-500/60 px-4 py-3 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent min-h-[44px]"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                  className="flex-1 rounded-lg border border-purple-500/60 px-4 py-3 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent min-h-[44px]"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
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
                        ${product.clientPrice?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">{product.totalStock || 0}</td>
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
                            onClick={() => handleDelete(product._id, product.name)}
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
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800/50 px-6 py-4">
                <div className="text-sm text-gray-400">
                  Página {pagination.page} de {pagination.pages} • Total: {pagination.total} productos
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
