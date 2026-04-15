import { AnimatePresence, m as motion } from "framer-motion";
import { BookOpen, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/ui";
import { productService } from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function PriceCatalogModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await productService.getAll({ limit: 1000 });
        setProducts(response.data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            "No se pudo cargar el catálogo de precios"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
      >
        <BookOpen className="h-4 w-4" />
        Catálogo de Precios
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Catálogo de Precios
                  </h2>
                  <p className="text-xs text-gray-300">
                    Consulta precios vigentes en tiempo real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {error ? (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                {loading ? (
                  <div className="flex items-center justify-center py-16 text-gray-300">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando catálogo...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-sm">
                      <thead className="text-xs uppercase tracking-wide text-gray-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Producto</th>
                          <th className="px-3 py-2 text-right">
                            Precio employee
                          </th>
                          <th className="px-3 py-2 text-right">
                            Precio público
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sortedProducts.map(item => (
                          <tr key={item._id} className="hover:bg-white/5">
                            <td className="px-3 py-2 text-white">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-right text-blue-200">
                              {currency.format(
                                Number(item.employeePrice || 0)
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-100">
                              {currency.format(Number(item.clientPrice || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
