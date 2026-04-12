import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../../context/BusinessContext";
import { authService } from "../../auth/services";
import {
  type DispatchRequest,
  dispatchService,
} from "../../branches/services/dispatch.service";
import { productService } from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";

interface DraftItem {
  productId: string;
  quantity: number;
}

const resolveEntityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") {
      return null;
    }
    return trimmed;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
  };

  return (
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    null
  );
};

const normalizeProduct = (
  product: Product | null | undefined
): Product | null => {
  if (!product) return null;

  const normalizedId = resolveEntityId(product._id);
  if (!normalizedId) return null;

  return {
    ...product,
    _id: normalizedId,
  };
};

const emptyDispatchResult = {
  data: [] as DispatchRequest[],
  pagination: {
    page: 1,
    limit: 0,
    total: 0,
    pages: 0,
  },
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getItemLabel = (item: DispatchRequest["items"][number]) => {
  if (!item?.product) return "Producto";
  if (typeof item.product === "string") return "Producto";
  return item.product.name || "Producto";
};

export default function DistributorRequestDispatchPage() {
  const navigate = useNavigate();
  const { businessId, hydrating: businessHydrating } = useBusiness();
  const currentUser = authService.getCurrentUser();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DispatchRequest[]>([]);
  const [inTransitRequests, setInTransitRequests] = useState<DispatchRequest[]>(
    []
  );
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { productId: "", quantity: 1 },
  ]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadContext = useCallback(async () => {
    if (businessHydrating) {
      return;
    }

    if (!businessId) {
      setProducts([]);
      setPendingRequests([]);
      setInTransitRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        allProductsResponse,
        myCatalogResponse,
        pendingResponse,
        transitResponse,
      ] = await Promise.all([
        productService.getAll({ isDeleted: false }).catch(() => ({
          data: [] as Product[],
        })),
        productService.getDistributorProducts().catch(() => ({
          data: [] as Product[],
        })),
        dispatchService
          .getRequests({
            status: "PENDIENTE",
            page: 1,
            limit: 20,
          })
          .catch(() => emptyDispatchResult),
        dispatchService
          .getRequests({
            status: "DESPACHADO",
            page: 1,
            limit: 20,
          })
          .catch(() => emptyDispatchResult),
      ]);

      const productsMap = new Map<string, Product>();
      const normalizedBusinessProducts = (allProductsResponse.data || [])
        .map(product => normalizeProduct(product))
        .filter((product): product is Product => Boolean(product));

      for (const product of normalizedBusinessProducts) {
        productsMap.set(product._id, product);
      }

      const normalizedCatalogProducts = (myCatalogResponse.data || [])
        .map(product => normalizeProduct(product))
        .filter((product): product is Product => Boolean(product));

      if (productsMap.size === 0) {
        for (const product of normalizedCatalogProducts) {
          productsMap.set(product._id, product);
        }
      } else {
        for (const product of normalizedCatalogProducts) {
          if (!productsMap.has(product._id)) {
            continue;
          }

          productsMap.set(product._id, {
            ...productsMap.get(product._id),
            ...product,
          });
        }
      }

      const availableProducts = [...productsMap.values()]
        .filter(product => !product.isPromotion && product.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));

      setProducts(availableProducts);
      setPendingRequests(pendingResponse.data || []);
      setInTransitRequests(transitResponse.data || []);
    } finally {
      setLoading(false);
    }
  }, [businessHydrating, businessId]);

  useEffect(() => {
    if (businessHydrating) return;
    loadContext();
  }, [loadContext, businessHydrating]);

  const pendingUnits = useMemo(
    () =>
      pendingRequests.reduce(
        (accumulator, request) => accumulator + Number(request.totalUnits || 0),
        0
      ),
    [pendingRequests]
  );

  const inTransitUnits = useMemo(
    () =>
      inTransitRequests.reduce(
        (accumulator, request) => accumulator + Number(request.totalUnits || 0),
        0
      ),
    [inTransitRequests]
  );

  const updateDraftItem = (
    index: number,
    patch: Partial<{ productId: string; quantity: number }>
  ) => {
    setDraftItems(currentItems =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  };

  const addDraftItem = () => {
    setDraftItems(currentItems => [
      ...currentItems,
      { productId: "", quantity: 1 },
    ]);
  };

  const removeDraftItem = (index: number) => {
    setDraftItems(currentItems =>
      currentItems.filter((_, idx) => idx !== index)
    );
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const distributorId = resolveEntityId(currentUser?._id);

    if (!distributorId) {
      setMessage({
        type: "error",
        text: "No se pudo identificar tu sesion. Inicia sesion nuevamente.",
      });
      return;
    }

    if (!businessId) {
      setMessage({
        type: "error",
        text: "Selecciona un negocio para enviar solicitudes de despacho.",
      });
      return;
    }

    const cleanItems = draftItems
      .map(item => ({
        productId: resolveEntityId(item.productId),
        quantity: Number(item.quantity || 0),
      }))
      .filter(
        (item): item is { productId: string; quantity: number } =>
          Boolean(item.productId) && item.quantity > 0
      );

    if (cleanItems.length === 0) {
      setMessage({
        type: "error",
        text: "Agrega al menos un producto valido para la solicitud.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await dispatchService.createRequest({
        distributorId,
        items: cleanItems,
        notes: notes.trim() || undefined,
      });

      setDraftItems([{ productId: "", quantity: 1 }]);
      setNotes("");
      setMessage({
        type: "success",
        text: "Solicitud enviada. Bodega la revisara para su despacho.",
      });

      window.dispatchEvent(new Event("dispatch-updated"));
      await loadContext();
    } catch (error) {
      const apiError = error as {
        response?: { data?: { message?: string } };
      };
      setMessage({
        type: "error",
        text:
          apiError?.response?.data?.message ||
          "No se pudo enviar la solicitud. Intenta nuevamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-linear-to-br min-h-screen from-gray-950 via-blue-950/20 to-gray-900 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-2xl border border-blue-800/40 bg-gray-900/70 p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-white sm:text-4xl">
            Solicitar Pedido de Reposicion
          </h1>
          <p className="mt-2 text-sm text-gray-300 sm:text-base">
            Crea una solicitud para que bodega despache unidades a tu
            inventario.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-amber-300">
                Solicitudes pendientes
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {pendingRequests.length}
              </p>
              <p className="text-sm text-amber-100">{pendingUnits} unidades</p>
            </article>

            <article className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-sky-300">
                Despachos en camino
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {inTransitRequests.length}
              </p>
              <p className="text-sm text-sky-100">{inTransitUnits} unidades</p>
            </article>

            <article className="rounded-xl border border-gray-700 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">
                Estado rapido
              </p>
              <button
                type="button"
                onClick={() => navigate("/staff/my-shipments")}
                className="mt-2 min-h-11 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Ver pedidos en camino
              </button>
            </article>
          </div>
        </section>

        {message && (
          <section
            className={`rounded-xl p-4 ${
              message.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10"
                : "border border-red-500/30 bg-red-900/20"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                message.type === "success" ? "text-emerald-200" : "text-red-200"
              }`}
            >
              {message.text}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Crear nueva solicitud
              </h2>
              <p className="text-sm text-gray-400">
                Selecciona referencias y cantidades para enviar a bodega.
              </p>
            </div>
            <button
              type="button"
              onClick={loadContext}
              disabled={loading || submitting}
              className="min-h-11 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 text-sm font-medium text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refrescar datos
            </button>
          </div>

          <form onSubmit={submitRequest} className="space-y-4">
            <div className="space-y-3">
              {draftItems.map((item, index) => (
                <div
                  key={`${index}-${item.productId}`}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-gray-950/70 p-3 md:grid-cols-[1fr_140px_120px]"
                >
                  <select
                    value={item.productId}
                    onChange={event =>
                      updateDraftItem(index, { productId: event.target.value })
                    }
                    className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-100"
                    required
                  >
                    <option value="">Selecciona producto</option>
                    {products.map(product => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={event =>
                      updateDraftItem(index, {
                        quantity: Number(event.target.value || 0),
                      })
                    }
                    className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => removeDraftItem(index)}
                    disabled={draftItems.length === 1}
                    className="min-h-11 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">
                Notas para bodega (opcional)
              </label>
              <textarea
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Ej: necesito prioridad para fin de semana"
                rows={3}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={addDraftItem}
                className="min-h-11 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Agregar referencia
              </button>
              <button
                type="submit"
                disabled={submitting || loading || products.length === 0}
                className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Enviando solicitud..." : "Enviar solicitud"}
              </button>
            </div>
          </form>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-white">
              Mis solicitudes pendientes
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              En espera de preparacion y despacho desde bodega.
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-gray-400">Cargando...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No tienes solicitudes pendientes.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingRequests.map(request => (
                  <article
                    key={request._id}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                  >
                    <p className="text-xs text-gray-400">
                      Creada: {formatDateTime(request.createdAt)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-200">
                      {request.totalUnits} unidades solicitadas
                    </p>
                    {request.notes?.trim() && (
                      <p className="mt-1 text-xs text-gray-300">
                        Nota: {request.notes}
                      </p>
                    )}
                    <ul className="mt-3 space-y-1 text-sm text-gray-200">
                      {request.items.map((item, index) => (
                        <li key={`${request._id}-${index}`}>
                          {getItemLabel(item)}: {item.quantity} und
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-white">
              Pedidos despachados
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Pendientes de confirmacion de recepcion.
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-gray-400">Cargando...</p>
            ) : inTransitRequests.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No tienes pedidos en camino por ahora.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {inTransitRequests.map(request => (
                  <article
                    key={request._id}
                    className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4"
                  >
                    <p className="text-xs text-gray-400">
                      Despachado: {formatDateTime(request.dispatchedAt)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-sky-200">
                      {request.totalUnits} unidades en camino
                    </p>
                    <p className="mt-1 text-xs text-gray-300">
                      Guia: {request.shippingGuide?.trim() || "Sin referencia"}
                    </p>
                  </article>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("/staff/my-shipments")}
              className="mt-4 min-h-11 w-full rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Ir a confirmar recepcion
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
