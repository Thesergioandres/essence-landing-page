import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categoryService, productService } from "../api/services.ts";
import type { Category, Product } from "../types";

export default function Products() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
      ]);
      setProducts(productsData);
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
    const matchesCategory = categoryFilter
      ? (typeof product.category === "string"
          ? product.category
          : product.category._id) === categoryFilter
      : true;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">Productos</h1>
          <p className="mt-2 text-gray-400">
            Gestiona el catálogo de Essence. Puedes agregar, editar o eliminar
            productos en cualquier momento.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/add-product")}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          <span className="text-2xl leading-none">＋</span>
          Nuevo producto
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por nombre..."
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        <select
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-3 font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
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
        <div className="flex h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center text-gray-400">
          No se encontraron productos con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50">
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
                        className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(product._id, product.name)}
                        className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600/20"
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
      )}
    </div>
  );
}
