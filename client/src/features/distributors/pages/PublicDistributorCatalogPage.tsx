import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import { LoadingSpinner } from "../../../shared/components/ui";
import type { Product } from "../../../types";

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <LoadingSpinner size="lg" message="Cargando catálogo..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
        <div className="text-center">
          <div className="mb-4 text-6xl">😕</div>
          <h1 className="mb-2 text-2xl font-bold text-white">{error}</h1>
          <p className="text-gray-400">Verifica que el enlace sea correcto</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white">
              Catálogo de {distributor?.name || "Productos"}
            </h1>
            {distributor?.phone && (
              <p className="mt-2 text-gray-300">📱 {distributor.phone}</p>
            )}
            {distributor?.email && (
              <p className="mt-1 text-gray-400">✉️ {distributor.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {products.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12 text-center backdrop-blur-sm">
            <div className="mb-4 text-6xl">📦</div>
            <h2 className="mb-2 text-xl font-semibold text-white">
              No hay productos disponibles
            </h2>
            <p className="text-gray-400">
              El catálogo está temporalmente vacío
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map(product => (
              <div
                key={product._id}
                className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm transition-all hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10"
              >
                {/* Product Image */}
                <div className="aspect-square bg-gray-900/50">
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
                      <p className="text-2xl font-bold text-purple-400">
                        {formatCurrency(product.clientPrice || 0)}
                      </p>
                    </div>
                    {product.totalStock !== undefined && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Disponible</p>
                        <p className="font-semibold text-green-400">
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
      <div className="border-t border-gray-700/50 bg-gray-900/50 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-400">
          <p>Para realizar un pedido, contacta directamente al distribuidor</p>
        </div>
      </div>
    </div>
  );
}
