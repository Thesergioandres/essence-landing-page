import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../../shared/components/ui/LoadingSpinner";
import { useProducts } from "../hooks/useProducts";

export default function InventoryPage() {
  const navigate = useNavigate();
  const { products, loading, error, refresh } = useProducts();
  // We can expose refresh via a button if needed. For now suppressing unused warning.
  // Or just destructure it to use later.
  void refresh;
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 overflow-hidden p-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Inventario (V2)
          </h1>
          <p className="mt-1 text-sm text-gray-400 sm:mt-2 sm:text-base">
            Gestión de productos con Arquitectura Hexagonal.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/v2/products/new")} // Temporary route until refactor complete
          className="bg-linear-to-r inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg from-purple-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 active:scale-[0.98] sm:px-5 sm:text-base md:w-auto"
        >
          <span className="text-xl leading-none sm:text-2xl">＋</span>
          Nuevo producto
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:w-1/2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre..."
          className="rounded-lg border border-gray-600 bg-gray-900/50 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:px-4 sm:py-3 sm:text-base"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center sm:h-96">
          <LoadingSpinner size="lg" message="Cargando inventario..." />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-sm text-gray-400 sm:rounded-xl sm:p-12 sm:text-base">
          No se encontraron productos.
        </div>
      ) : (
        <div className="hidden overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/50 shadow-lg backdrop-blur-sm md:block">
          <div className="w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Producto
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Precio Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Stock Total
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
                    <td className="px-6 py-4 font-semibold text-purple-400">
                      ${product.clientPrice?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {product.totalStock || 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => console.log("Edit legacy")}
                          className="rounded-lg border border-purple-500/60 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/20 active:scale-95"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
