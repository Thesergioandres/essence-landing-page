import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "../../../context/BusinessContext";
import { Button, ConfidentialBadge } from "../../../shared/components/ui";
import { useFinancialPrivacy } from "../../auth/utils/financialPrivacy";
import {
  type DispatchRequest,
  dispatchService,
} from "../../branches/services/dispatch.service";

const formatDateTime = (value?: string) => {
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

const resolveGuideImage = (value?: string) => {
  const guideImage = String(value || "").trim();
  if (!guideImage) return "";
  if (
    /^https?:\/\//i.test(guideImage) ||
    guideImage.startsWith("data:image/") ||
    guideImage.startsWith("blob:")
  ) {
    return guideImage;
  }
  if (guideImage.startsWith("//")) {
    return `https:${guideImage}`;
  }
  return guideImage;
};

const getProductLabel = (item: DispatchRequest["items"][number]) => {
  if (!item?.product) return "Producto";
  if (typeof item.product === "string") return "Producto";
  return item.product.name || "Producto";
};

const getProductKey = (
  item: DispatchRequest["items"][number],
  index: number
) => {
  if (!item?.product) return `${index}-item`;
  if (typeof item.product === "string") return `${item.product}-${index}`;
  return `${item.product._id || index}`;
};

export default function EmployeeShipmentsPage() {
  const navigate = useNavigate();
  const { businessId, hydrating: businessHydrating } = useBusiness();
  const { hideFinancialData } = useFinancialPrivacy();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [pendingDispatchCount, setPendingDispatchCount] = useState(0);
  const [pendingReceptionCount, setPendingReceptionCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<DispatchRequest[]>([]);
  const [shipmentsInTransit, setShipmentsInTransit] = useState<
    DispatchRequest[]
  >([]);
  const [receivedHistory, setReceivedHistory] = useState<DispatchRequest[]>([]);

  const loadShipments = useCallback(async () => {
    if (businessHydrating) {
      return;
    }

    if (!businessId) {
      setError(null);
      setLoading(false);
      setPendingRequests([]);
      setPendingDispatchCount(0);
      setShipmentsInTransit([]);
      setReceivedHistory([]);
      setPendingReceptionCount(0);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const [pendingResponse, inTransitResponse, receivedResponse] =
        await Promise.all([
          dispatchService.getRequests({
            status: "PENDIENTE",
            page: 1,
            limit: 30,
          }),
          dispatchService.getRequests({
            status: "DESPACHADO",
            page: 1,
            limit: 50,
          }),
          dispatchService.getRequests({
            status: "RECIBIDO",
            page: 1,
            limit: 30,
          }),
        ]);

      setPendingRequests(pendingResponse.data || []);
      setPendingDispatchCount(
        Number(
          pendingResponse.pagination?.total ||
            (pendingResponse.data || []).length ||
            0
        )
      );
      setShipmentsInTransit(inTransitResponse.data || []);
      setReceivedHistory(receivedResponse.data || []);
      setPendingReceptionCount(
        Number(
          inTransitResponse.pagination?.total ||
            (inTransitResponse.data || []).length ||
            0
        )
      );
    } catch (loadError) {
      console.error("Error cargando pedidos en camino:", loadError);
      setError("No se pudieron cargar tus pedidos en camino.");
      setPendingRequests([]);
      setPendingDispatchCount(0);
      setShipmentsInTransit([]);
      setReceivedHistory([]);
      setPendingReceptionCount(0);
    } finally {
      setLoading(false);
    }
  }, [businessHydrating, businessId]);

  useEffect(() => {
    if (businessHydrating) return;
    loadShipments();
  }, [loadShipments, businessHydrating]);

  useEffect(() => {
    if (loading) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        ".shipment-premium-block",
        { autoAlpha: 0, y: 24, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.58,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: "auto",
        }
      );

      const dots = gsap.utils.toArray<HTMLElement>(".shipment-progress-dot");
      dots.forEach((dot, index) => {
        gsap.fromTo(
          dot,
          { x: 0, autoAlpha: 0.6, scale: 0.92 },
          {
            x: () => Math.max((dot.parentElement?.clientWidth || 0) - 16, 0),
            autoAlpha: 1,
            scale: 1.04,
            duration: 2.5 + index * 0.22,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            overwrite: "auto",
          }
        );
      });
    }, pageRef);

    return () => {
      context.revert();
    };
  }, [
    loading,
    pendingRequests.length,
    receivedHistory.length,
    shipmentsInTransit.length,
  ]);

  const pendingUnits = useMemo(
    () =>
      shipmentsInTransit.reduce(
        (acc, request) => acc + Number(request.totalUnits || 0),
        0
      ),
    [shipmentsInTransit]
  );

  const requestedUnits = useMemo(
    () =>
      pendingRequests.reduce(
        (acc, request) => acc + Number(request.totalUnits || 0),
        0
      ),
    [pendingRequests]
  );

  const receivedUnits = useMemo(
    () =>
      receivedHistory.reduce(
        (acc, request) => acc + Number(request.totalUnits || 0),
        0
      ),
    [receivedHistory]
  );

  const handleConfirmReception = async (request: DispatchRequest) => {
    if (
      !window.confirm(
        `Confirmar recepción de ${request.totalUnits} unidades para este despacho?`
      )
    ) {
      return;
    }

    try {
      setSavingRequestId(request._id);
      await dispatchService.confirmReception(request._id);
      window.dispatchEvent(new Event("dispatch-updated"));
      await loadShipments();
    } catch (confirmError: any) {
      console.error("Error confirmando recepción:", confirmError);
      alert(
        confirmError?.response?.data?.message ||
          "No se pudo confirmar la recepción del pedido."
      );
    } finally {
      setSavingRequestId(null);
    }
  };

  return (
    <div
      ref={pageRef}
      className="bg-linear-to-br min-h-screen from-[#04070f] via-[#061326] to-[#070a12] px-3 py-4 sm:px-6 sm:py-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="shipment-premium-block bg-gray-900/58 rounded-2xl border border-white/10 p-4 shadow-[0_16px_30px_rgba(2,6,23,0.38)] backdrop-blur-xl sm:p-6">
          <h1 className="text-2xl font-bold text-white sm:text-4xl">
            Mis Pedidos en Camino
          </h1>
          <p className="mt-2 text-sm text-gray-300 sm:text-base">
            Revisa tus solicitudes enviadas, valida despachos y confirma
            recepción para mover unidades de stock en tránsito a stock
            disponible.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="bg-amber-500/12 rounded-xl border border-amber-500/30 p-4 backdrop-blur-lg">
              <p className="text-xs uppercase tracking-wider text-amber-300">
                Solicitudes en preparacion
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {pendingDispatchCount}
              </p>
              <p className="text-sm text-amber-100">
                {requestedUnits} unidades
              </p>
            </article>

            <article className="bg-sky-500/12 rounded-xl border border-sky-500/35 p-4 backdrop-blur-lg">
              <p className="text-xs uppercase tracking-wider text-sky-300">
                Pendientes por recibir
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {pendingReceptionCount}
              </p>
              <p className="text-sm text-sky-100">{pendingUnits} unidades</p>
            </article>

            <article className="bg-emerald-500/12 rounded-xl border border-emerald-500/35 p-4 backdrop-blur-lg">
              <p className="text-xs uppercase tracking-wider text-emerald-300">
                Entradas registradas
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {receivedHistory.length}
              </p>
              <p className="text-sm text-emerald-100">
                {receivedUnits} unidades
              </p>
            </article>

            <article className="border-white/12 rounded-xl border bg-black/25 p-4 backdrop-blur-lg">
              <p className="text-xs uppercase tracking-wider text-gray-400">
                Acciones rápidas
              </p>
              <Button
                type="button"
                onClick={loadShipments}
                disabled={loading || savingRequestId !== null}
                variant="ghost"
                size="sm"
                className="mt-2 w-full rounded-xl border border-slate-100/40 bg-[linear-gradient(120deg,#e2e8f0_0%,#cbd5e1_22%,#94a3b8_48%,#cbd5e1_72%,#f1f5f9_100%)] font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_20px_rgba(15,23,42,0.35)] hover:brightness-105"
              >
                Refrescar pedidos
              </Button>
              {hideFinancialData && (
                <div className="mt-3">
                  <ConfidentialBadge
                    compact
                    label="Costo logístico interno"
                    className="pointer-events-none select-none"
                  />
                </div>
              )}
            </article>
          </div>
        </section>

        {error && (
          <section className="shipment-premium-block rounded-xl border border-red-500/30 bg-red-900/20 p-4 backdrop-blur-lg">
            <p className="text-sm font-medium text-red-200">{error}</p>
          </section>
        )}

        <section className="shipment-premium-block bg-gray-900/56 rounded-2xl border border-white/10 p-4 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">
              Solicitudes En Preparación
            </h2>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
              {pendingDispatchCount} pendientes
            </span>
          </div>

          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-400" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
              <p className="text-sm text-gray-400">
                No tienes solicitudes pendientes por preparar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map(request => (
                <article
                  key={request._id}
                  className="bg-amber-500/8 rounded-xl border border-amber-500/30 p-4 backdrop-blur-lg"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-300">
                      Solicitud creada: {formatDateTime(request.createdAt)}
                    </p>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                      {request.totalUnits} unidades
                    </span>
                  </div>

                  {request.notes?.trim() && (
                    <p className="mt-2 text-sm text-gray-400">
                      Nota: {request.notes}
                    </p>
                  )}

                  <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                    {request.items.map((item, index) => (
                      <div
                        key={getProductKey(item, index)}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-200">
                          {getProductLabel(item)}
                        </span>
                        <span className="font-semibold text-amber-300">
                          {item.quantity} u
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/staff/request-dispatch")}
            className="bg-amber-500/12 mt-4 min-h-11 w-full rounded-xl border border-amber-500/40 px-4 text-sm font-semibold text-amber-200 transition-all duration-300 hover:bg-amber-500/20"
          >
            Solicitar un nuevo pedido
          </button>
        </section>

        <section className="shipment-premium-block bg-gray-900/56 rounded-2xl border border-white/10 p-4 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">
              Pedidos Despachados (Pendientes de Recepción)
            </h2>
            <span className="rounded-full border border-sky-500/40 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200">
              {pendingReceptionCount} pendientes
            </span>
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-400" />
            </div>
          ) : shipmentsInTransit.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
              <p className="text-sm text-gray-400">
                {pendingDispatchCount > 0
                  ? `Aun no hay pedidos despachados. Tienes ${pendingDispatchCount} solicitud(es) en preparacion.`
                  : "No tienes pedidos pendientes por recibir."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {shipmentsInTransit.map(request => {
                const guideImage = resolveGuideImage(request.guideImage);

                return (
                  <article
                    key={request._id}
                    className="border-sky-500/28 rounded-xl border bg-black/30 p-4 backdrop-blur-lg"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm text-gray-300">
                          Despachado:{" "}
                          {formatDateTime(
                            request.dispatchedAt || request.createdAt
                          )}
                        </p>
                        <p className="mt-1 text-sm text-gray-300">
                          Guía:{" "}
                          {request.shippingGuide?.trim() ||
                            "Sin número de guía"}
                        </p>
                        {request.dispatchNotes?.trim() && (
                          <p className="mt-1 text-sm text-gray-400">
                            Nota: {request.dispatchNotes}
                          </p>
                        )}
                      </div>

                      <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                        {request.totalUnits} unidades
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-sky-400/25 bg-sky-500/5 p-3">
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/80">
                        <span>Despachado</span>
                        <span>Recepción</span>
                      </div>
                      <div className="relative mt-2 h-2 overflow-hidden rounded-full border border-sky-300/20 bg-slate-900/90">
                        <span className="bg-linear-to-r absolute inset-0 from-cyan-500/10 via-sky-300/35 to-emerald-300/20" />
                        <span className="shipment-progress-dot absolute top-1/2 block h-3 w-3 -translate-y-1/2 rounded-full border border-cyan-100/75 bg-cyan-300 shadow-[0_0_14px_rgba(56,189,248,0.85)]" />
                      </div>
                      <p className="mt-2 text-[11px] text-cyan-200/85">
                        Activo logístico digital en movimiento hacia tu sede.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Referencias / sabores
                        </p>
                        <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                          {request.items.map((item, index) => (
                            <div
                              key={getProductKey(item, index)}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-200">
                                {getProductLabel(item)}
                              </span>
                              <span className="font-semibold text-sky-300">
                                {item.quantity} u
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {guideImage ? (
                          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Evidencia de guía
                            </p>
                            <img
                              src={guideImage}
                              alt="Guía de despacho"
                              className="h-32 w-full rounded-md object-cover"
                              loading="lazy"
                            />
                            <a
                              href={guideImage}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition-all duration-300 hover:border-sky-400/60 hover:bg-sky-500/20"
                            >
                              Ver imagen completa
                            </a>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-3 text-xs text-gray-500">
                            No hay foto de guía adjunta para este despacho.
                          </div>
                        )}

                        {hideFinancialData && (
                          <ConfidentialBadge
                            compact
                            label="Costo de transporte"
                            className="pointer-events-none select-none"
                          />
                        )}

                        <Button
                          type="button"
                          onClick={() => handleConfirmReception(request)}
                          disabled={savingRequestId !== null}
                          loading={savingRequestId === request._id}
                          variant="ghost"
                          size="sm"
                          className="w-full rounded-xl border border-slate-100/45 bg-[linear-gradient(120deg,#f8fafc_0%,#dbe4ef_22%,#94a3b8_50%,#d1dce8_72%,#f8fafc_100%)] font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_20px_rgba(15,23,42,0.35)] transition-transform hover:scale-[1.01] hover:brightness-105 active:scale-[0.97]"
                        >
                          {savingRequestId === request._id
                            ? "Confirmando recepción..."
                            : "Confirmar Recepción"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="shipment-premium-block bg-gray-900/56 rounded-2xl border border-white/10 p-4 backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-semibold text-white">
            Historial de Entradas
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Últimos despachos ya recibidos en tu inventario.
          </p>

          {receivedHistory.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
              <p className="text-sm text-gray-400">
                Aún no tienes recepciones confirmadas.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {receivedHistory.map(request => {
                const itemsSummary = request.items
                  .map(item => `${getProductLabel(item)} (${item.quantity}u)`)
                  .join(", ");

                return (
                  <article
                    key={request._id}
                    className="border-emerald-500/32 bg-emerald-900/18 rounded-lg border p-4 backdrop-blur-lg"
                  >
                    <p className="text-sm text-emerald-200">
                      Recibido:{" "}
                      {formatDateTime(request.receivedAt || request.updatedAt)}
                    </p>
                    <p className="mt-1 text-sm text-gray-300">
                      Guía: {request.shippingGuide?.trim() || "Sin referencia"}
                    </p>
                    <p className="mt-1 text-sm text-gray-300">
                      Total: {request.totalUnits} unidades
                    </p>
                    <p className="mt-2 text-xs text-gray-400">{itemsSummary}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
