import { useCallback, useEffect, useMemo, useState } from "react";
import { employeeService } from "../../employees/services";
import { productService } from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";
import {
  type DispatchRequest,
  dispatchService,
} from "../services/dispatch.service";

interface EmployeeOption {
  _id: string;
  name: string;
  email?: string;
}

interface DraftItem {
  productId: string;
  quantity: number;
}

const statusBadgeClass = (status: DispatchRequest["status"]) => {
  if (status === "PENDIENTE") return "bg-amber-500/20 text-amber-300";
  if (status === "DESPACHADO") return "bg-sky-500/20 text-sky-300";
  if (status === "RECIBIDO") return "bg-emerald-500/20 text-emerald-300";
  return "bg-zinc-500/20 text-zinc-300";
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getUserLabel = (value: unknown) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  const user = value as { name?: string; email?: string };
  return user.name || user.email || "Usuario";
};

export default function DispatchCenterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [pendingRequests, setPendingRequests] = useState<DispatchRequest[]>([]);
  const [inTransitRequests, setInTransitRequests] = useState<DispatchRequest[]>(
    []
  );
  const [receivedRequests, setReceivedRequests] = useState<DispatchRequest[]>(
    []
  );

  const [hotSectors, setHotSectors] = useState<{
    canViewFinancialMargins: boolean;
    employees: Array<{
      zoneId: string;
      zoneName: string;
      units: number;
      revenue: number;
      marginProfit: number;
    }>;
    branches: Array<{
      zoneId: string;
      zoneName: string;
      units: number;
      revenue: number;
      marginProfit: number;
    }>;
  }>({
    canViewFinancialMargins: false,
    employees: [],
    branches: [],
  });

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [draftEmployeeId, setDraftEmployeeId] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { productId: "", quantity: 1 },
  ]);

  const loadMeta = useCallback(async () => {
    try {
      const [distResponse, productsResponse] = await Promise.all([
        employeeService.getAll({ active: true }),
        productService.getAll({ isDeleted: false }),
      ]);

      const employeeItems = Array.isArray(distResponse)
        ? distResponse
        : distResponse?.data || [];
      const productItems = Array.isArray(productsResponse)
        ? productsResponse
        : productsResponse?.data || [];

      setEmployees(
        employeeItems.filter(
          (item: any) => item?.role === "employee" && item?._id
        )
      );
      setProducts(productItems);
    } catch (error) {
      console.error("Error cargando catalogos de despacho:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const commonParams = filterEmployeeId
        ? { employeeId: filterEmployeeId }
        : undefined;

      const [pendingRes, inTransitRes, receivedRes, countRes, hotRes] =
        await Promise.all([
          dispatchService.getRequests({
            status: "PENDIENTE",
            limit: 50,
            ...(commonParams || {}),
          }),
          dispatchService.getRequests({
            status: "DESPACHADO",
            limit: 50,
            ...(commonParams || {}),
          }),
          dispatchService.getRequests({
            status: "RECIBIDO",
            limit: 20,
            ...(commonParams || {}),
          }),
          dispatchService.getPendingCount(),
          dispatchService.getHotSectors({ limit: 5 }),
        ]);

      setPendingRequests(pendingRes.data || []);
      setInTransitRequests(inTransitRes.data || []);
      setReceivedRequests(receivedRes.data || []);
      setPendingCount(Number(countRes || 0));
      setHotSectors(hotRes);

      window.dispatchEvent(new Event("dispatch-updated"));
    } catch (error) {
      console.error("Error cargando central de despachos:", error);
      alert("No se pudo cargar la central de despachos");
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalUnitsPending = useMemo(
    () =>
      pendingRequests.reduce(
        (acc, item) => acc + Number(item.totalUnits || 0),
        0
      ),
    [pendingRequests]
  );

  const totalUnitsInTransit = useMemo(
    () =>
      inTransitRequests.reduce(
        (acc, item) => acc + Number(item.totalUnits || 0),
        0
      ),
    [inTransitRequests]
  );

  const onDraftItemChange = (
    index: number,
    patch: Partial<{ productId: string; quantity: number }>
  ) => {
    setDraftItems(current =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  };

  const addDraftItem = () => {
    setDraftItems(current => [...current, { productId: "", quantity: 1 }]);
  };

  const removeDraftItem = (index: number) => {
    setDraftItems(current => current.filter((_, idx) => idx !== index));
  };

  const submitDraftRequest = async () => {
    try {
      if (!draftEmployeeId) {
        alert("Selecciona un employee para crear la solicitud");
        return;
      }

      const cleanItems = draftItems
        .map(item => ({
          productId: String(item.productId || "").trim(),
          quantity: Number(item.quantity || 0),
        }))
        .filter(item => item.productId && item.quantity > 0);

      if (cleanItems.length === 0) {
        alert("Agrega al menos un item valido");
        return;
      }

      setSaving(true);
      await dispatchService.createRequest({
        employeeId: draftEmployeeId,
        items: cleanItems,
        notes: draftNotes,
      });

      setDraftNotes("");
      setDraftItems([{ productId: "", quantity: 1 }]);
      await loadData();
    } catch (error: any) {
      console.error("Error creando solicitud de despacho:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo crear la solicitud de despacho"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDispatch = async (requestId: string) => {
    try {
      const shippingGuide =
        window.prompt("Numero o referencia de guia de envio:", "") || "";
      const guideImage =
        window.prompt("URL de evidencia (opcional):", "") || "";
      const dispatchNotes =
        window.prompt("Notas del despacho (opcional):", "") || "";

      if (!shippingGuide.trim() && !guideImage.trim()) {
        alert("Debes ingresar una guia o una evidencia para despachar");
        return;
      }

      setSaving(true);
      await dispatchService.markAsDispatched(requestId, {
        shippingGuide,
        guideImage,
        dispatchNotes,
      });
      await loadData();
    } catch (error: any) {
      console.error("Error marcando despacho:", error);
      alert(
        error?.response?.data?.message || "No se pudo marcar como despachado"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReception = async (requestId: string) => {
    if (!window.confirm("Confirmar recepcion de este despacho?")) return;

    try {
      setSaving(true);
      await dispatchService.confirmReception(requestId);
      await loadData();
    } catch (error: any) {
      console.error("Error confirmando recepcion:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo confirmar la recepcion del despacho"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-linear-to-br min-h-screen from-gray-950 via-cyan-950/20 to-gray-900 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-2xl border border-cyan-800/40 bg-gray-900/70 p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-white sm:text-4xl">
            Central de Despachos y Seguimiento
          </h1>
          <p className="mt-2 text-sm text-gray-300 sm:text-base">
            Control operativo de solicitudes, despacho y recepcion con
            trazabilidad de stock en transito.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-amber-300">
                Pendientes
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {pendingCount}
              </p>
              <p className="text-sm text-amber-100">
                {totalUnitsPending} unidades
              </p>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-sky-300">
                En transito
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {inTransitRequests.length}
              </p>
              <p className="text-sm text-sky-100">
                {totalUnitsInTransit} unidades
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-emerald-300">
                Recibidos (recientes)
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {receivedRequests.length}
              </p>
              <p className="text-sm text-emerald-100">Ultimos 20 registros</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">
                Filtrar por employee
              </label>
              <select
                value={filterEmployeeId}
                onChange={event => setFilterEmployeeId(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-gray-100"
              >
                <option value="">Todos</option>
                {employees.map(employee => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={loadData}
                disabled={loading || saving}
                className="min-h-11 w-full rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refrescar panel
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-white">
            Crear solicitud manual
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Util para generar una solicitud cuando el employee reporta por
            telefono o chat.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">
                Employee destino
              </label>
              <select
                value={draftEmployeeId}
                onChange={event => setDraftEmployeeId(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-gray-100"
              >
                <option value="">Seleccionar employee</option>
                {employees.map(employee => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">
                Notas
              </label>
              <input
                value={draftNotes}
                onChange={event => setDraftNotes(event.target.value)}
                placeholder="Ej: prioridad alta para sector norte"
                className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-gray-100"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {draftItems.map((item, index) => (
              <div
                key={`${index}-${item.productId}`}
                className="grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-gray-950/70 p-3 md:grid-cols-[1fr_150px_120px]"
              >
                <select
                  value={item.productId}
                  onChange={event =>
                    onDraftItemChange(index, { productId: event.target.value })
                  }
                  className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-100"
                >
                  <option value="">Seleccionar producto</option>
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
                    onDraftItemChange(index, {
                      quantity: Number(event.target.value || 0),
                    })
                  }
                  className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-100"
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

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={addDraftItem}
              className="min-h-11 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Agregar item
            </button>
            <button
              type="button"
              onClick={submitDraftRequest}
              disabled={saving}
              className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Crear solicitud
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-white">
              Solicitudes pendientes
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Revisar y despachar desde bodega.
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-gray-400">Cargando...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No hay solicitudes pendientes.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingRequests.map(request => (
                  <article
                    key={request._id}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {getUserLabel(request.employee)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Creada: {formatDate(request.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    <ul className="mt-3 space-y-1 text-sm text-gray-200">
                      {request.items.map((item, idx) => (
                        <li key={`${request._id}-item-${idx}`}>
                          {item.product?.name || "Producto"}: {item.quantity}{" "}
                          und
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => handleDispatch(request._id)}
                      disabled={saving}
                      className="mt-4 min-h-11 w-full rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Marcar como despachado
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-white">En transito</h2>
            <p className="mt-1 text-sm text-gray-400">
              Despachos enviados, pendientes por confirmar recepcion.
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-gray-400">Cargando...</p>
            ) : inTransitRequests.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No hay despachos en transito.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {inTransitRequests.map(request => (
                  <article
                    key={request._id}
                    className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {getUserLabel(request.employee)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Guia: {request.shippingGuide || "sin numero"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-gray-400">
                      Despachado: {formatDate(request.dispatchedAt)}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleConfirmReception(request._id)}
                      disabled={saving}
                      className="mt-4 min-h-11 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Confirmar recepcion
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-white">
            Sectores calientes
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Ranking por volumen de unidades vendidas.
          </p>
          {!hotSectors.canViewFinancialMargins && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Modo operativo: margenes y utilidades ocultos por politica de
              privacidad financiera.
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
                Employees Top
              </h3>
              <div className="mt-3 space-y-2">
                {hotSectors.employees.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos</p>
                ) : (
                  hotSectors.employees.map(row => (
                    <div
                      key={row.zoneId}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {row.zoneName}
                        </p>
                        <p className="text-xs text-gray-400">{row.units} und</p>
                      </div>
                      {hotSectors.canViewFinancialMargins && (
                        <p className="text-xs text-emerald-300">
                          Margen: ${row.marginProfit.toLocaleString("es-CO")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-fuchsia-300">
                Sedes Top
              </h3>
              <div className="mt-3 space-y-2">
                {hotSectors.branches.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos</p>
                ) : (
                  hotSectors.branches.map(row => (
                    <div
                      key={row.zoneId}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {row.zoneName}
                        </p>
                        <p className="text-xs text-gray-400">{row.units} und</p>
                      </div>
                      {hotSectors.canViewFinancialMargins && (
                        <p className="text-xs text-emerald-300">
                          Margen: ${row.marginProfit.toLocaleString("es-CO")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
