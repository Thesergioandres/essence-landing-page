import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { gsap } from "gsap";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { advancedAnalyticsService } from "../../features/analytics/services";
import { ConfidentialBadge } from "../../shared/components/ui";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

interface TimelineDatum {
  date?: string;
  period?: string;
  _id?: string;
  revenue?: number;
  profit?: number;
  netProfit?: number;
  salesCount?: number;
  ordersCount?: number;
  quantity?: number;
}

interface SalesTimelineChartProps {
  period: "day" | "week" | "month";
  startDate?: string;
  endDate?: string;
  reloadKey?: number;
  hideFinancialData?: boolean;
  data?: TimelineDatum[];
  showOwnDistributorEarnings?: boolean;
  showAdminFinancials?: boolean;
  title?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);

const safeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const findPeakIndex = (values: number[]) => {
  if (values.length === 0) return -1;
  let peakIndex = 0;
  values.forEach((value, index) => {
    if (value > values[peakIndex]) {
      peakIndex = index;
    }
  });
  return peakIndex;
};

export const SalesTimelineChart: React.FC<SalesTimelineChartProps> = ({
  period,
  startDate,
  endDate,
  reloadKey = 0,
  hideFinancialData = false,
  data,
  showOwnDistributorEarnings,
  showAdminFinancials,
  title,
}) => {
  const [fetchedData, setFetchedData] = useState<TimelineDatum[]>([]);
  const [loading, setLoading] = useState(!data);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const chartRef = useRef<ChartJS<"line"> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldFetch = !data;
  const isCompactScreen = viewportWidth < 768;
  const isSmallScreen = viewportWidth < 640;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      setViewportWidth(window.innerWidth);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!shouldFetch) {
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    let isActive = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        const response = await advancedAnalyticsService.getSalesTimeline({
          startDate,
          endDate,
          groupBy:
            period === "day"
              ? "day"
              : period === "week"
                ? "week"
                : "month",
        });

        if (!isActive) return;

        const timeline = Array.isArray(response.timeline)
          ? response.timeline
          : [];
        setFetchedData(timeline);
      } catch {
        if (!isActive) return;
        setErrorMessage("No fue posible cargar la línea de tiempo.");
        setFetchedData([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isActive = false;
    };
  }, [endDate, period, reloadKey, shouldFetch, startDate]);

  const sourceData = data ?? fetchedData;
  const canShowOwnEarnings = showOwnDistributorEarnings ?? !hideFinancialData;
  const canShowAdminFinancials =
    (showAdminFinancials ?? !hideFinancialData) && !hideFinancialData;

  const preparedData = useMemo(() => {
    return (sourceData || [])
      .filter(Boolean)
      .map(item => {
        const rawDate = item.date || item.period || item._id || "";
        let label = rawDate;

        try {
          if (rawDate && typeof rawDate === "string") {
            label = format(parseISO(rawDate), "dd MMM", { locale: es });
          }
        } catch {
          label = rawDate;
        }

        return {
          rawDate,
          label,
          salesCount: safeNumber(item.salesCount ?? item.ordersCount),
          quantity: safeNumber(item.quantity),
          revenue: safeNumber(item.revenue),
          netProfit: safeNumber(item.netProfit ?? item.profit),
        };
      });
  }, [sourceData]);

  const labels = useMemo(() => preparedData.map(item => item.label), [preparedData]);
  const salesSeries = useMemo(
    () => preparedData.map(item => item.salesCount),
    [preparedData]
  );
  const quantitySeries = useMemo(
    () => preparedData.map(item => item.quantity),
    [preparedData]
  );
  const revenueSeries = useMemo(
    () => preparedData.map(item => item.revenue),
    [preparedData]
  );
  const ownEarningsSeries = useMemo(
    () => preparedData.map(item => item.netProfit),
    [preparedData]
  );

  const salesPeakIndex = useMemo(() => findPeakIndex(salesSeries), [salesSeries]);
  const revenuePeakIndex = useMemo(
    () => findPeakIndex(revenueSeries),
    [revenueSeries]
  );
  const ownPeakIndex = useMemo(
    () => findPeakIndex(ownEarningsSeries),
    [ownEarningsSeries]
  );

  const chartData = useMemo<ChartData<"line">>(() => {
    const datasets: any[] = [
      {
        type: "bar",
        label: "Ventas",
        data: salesSeries,
        yAxisID: "y",
        borderRadius: 8,
        backgroundColor: salesSeries.map((_, index) =>
          index === salesPeakIndex
            ? "rgba(56,189,248,0.5)"
            : "rgba(56,189,248,0.24)"
        ),
        borderColor: salesSeries.map((_, index) =>
          index === salesPeakIndex
            ? "rgba(125,211,252,0.95)"
            : "rgba(56,189,248,0.5)"
        ),
        borderWidth: 1,
        barThickness: 12,
        maxBarThickness: 18,
      },
      {
        type: "line",
        label: "Unidades",
        data: quantitySeries,
        yAxisID: "y",
        borderColor: "rgba(59,130,246,0.95)",
        backgroundColor: "rgba(59,130,246,0.2)",
        pointBackgroundColor: "rgba(147,197,253,0.95)",
        pointBorderColor: "rgba(191,219,254,1)",
        pointBorderWidth: 1,
        pointRadius: isCompactScreen ? 2 : 2.8,
        borderWidth: 2,
        tension: 0.28,
      },
    ];

    if (canShowAdminFinancials) {
      datasets.push({
        type: "line",
        label: "Ingresos",
        data: revenueSeries,
        yAxisID: "y1",
        borderColor: "rgba(14,165,233,0.95)",
        backgroundColor: "rgba(14,165,233,0.22)",
        pointRadius: context =>
          isCompactScreen
            ? 2
            : context.dataIndex === revenuePeakIndex
              ? 5
              : 2.4,
        pointBackgroundColor: context =>
          context.dataIndex === revenuePeakIndex
            ? "rgba(56,189,248,1)"
            : "rgba(125,211,252,0.9)",
        pointBorderColor: context =>
          context.dataIndex === revenuePeakIndex
            ? "rgba(224,242,254,1)"
            : "rgba(186,230,253,0.9)",
        pointBorderWidth: context =>
          context.dataIndex === revenuePeakIndex ? 2 : 1,
        borderWidth: 2.2,
        tension: 0.3,
        fill: true,
      });
    }

    if (canShowOwnEarnings) {
      datasets.push({
        type: "line",
        label: "Ganancia neta",
        data: ownEarningsSeries,
        yAxisID: "y1",
        borderColor: "rgba(192,132,252,0.95)",
        backgroundColor: "rgba(192,132,252,0.22)",
        pointRadius: context =>
          isCompactScreen ? 2 : context.dataIndex === ownPeakIndex ? 5 : 2.2,
        pointBackgroundColor: context =>
          context.dataIndex === ownPeakIndex
            ? "rgba(216,180,254,1)"
            : "rgba(233,213,255,0.9)",
        pointBorderColor: context =>
          context.dataIndex === ownPeakIndex
            ? "rgba(250,245,255,1)"
            : "rgba(243,232,255,0.9)",
        pointBorderWidth: context =>
          context.dataIndex === ownPeakIndex ? 2 : 1,
        borderWidth: 2.2,
        tension: 0.32,
        fill: false,
      });
    }

    return {
      labels,
      datasets,
    };
  }, [
    canShowAdminFinancials,
    canShowOwnEarnings,
    labels,
    ownEarningsSeries,
    ownPeakIndex,
    quantitySeries,
    revenuePeakIndex,
    revenueSeries,
    salesPeakIndex,
    salesSeries,
    isCompactScreen,
  ]);

  const chartOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: {
        mode: "index",
        intersect: false,
      },
      elements: {
        point: {
          radius: isCompactScreen ? 2 : 3,
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(226,232,240,0.92)",
            boxWidth: 12,
            boxHeight: 12,
            font: {
              size: isSmallScreen ? 10 : 11,
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(2,6,23,0.92)",
          borderColor: "rgba(148,163,184,0.35)",
          borderWidth: 1,
          titleColor: "rgba(248,250,252,0.95)",
          bodyColor: "rgba(226,232,240,0.92)",
          callbacks: {
            label: item => {
              const label = item.dataset.label || "Serie";
              const value = safeNumber(item.parsed?.y);

              if (label === "Ingresos" || label === "Ganancia neta") {
                return `${label}: ${formatCurrency(value)}`;
              }

              return `${label}: ${value.toLocaleString("es-CO")}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "rgba(148,163,184,0.9)",
            autoSkip: true,
            maxTicksLimit: isSmallScreen ? 4 : isCompactScreen ? 6 : 12,
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: isSmallScreen ? 10 : 11,
            },
          },
          grid: {
            color: "rgba(71,85,105,0.22)",
          },
        },
        y: {
          position: "left",
          ticks: {
            color: "rgba(148,163,184,0.9)",
            maxTicksLimit: isCompactScreen ? 5 : 8,
            font: {
              size: isSmallScreen ? 10 : 11,
            },
          },
          grid: {
            color: "rgba(71,85,105,0.24)",
          },
        },
        y1: {
          display: canShowAdminFinancials || canShowOwnEarnings,
          position: "right",
          ticks: {
            color: "rgba(148,163,184,0.9)",
            maxTicksLimit: isCompactScreen ? 5 : 8,
            font: {
              size: isSmallScreen ? 10 : 11,
            },
            callback: value => {
              const parsed = safeNumber(value);
              if (parsed >= 1000000) {
                return `${(parsed / 1000000).toFixed(1)}M`;
              }
              if (parsed >= 1000) {
                return `${(parsed / 1000).toFixed(0)}K`;
              }
              return parsed;
            },
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    }),
    [canShowAdminFinancials, canShowOwnEarnings, isCompactScreen, isSmallScreen]
  );

  useEffect(() => {
    if (!containerRef.current || preparedData.length === 0) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: "power3.out",
        }
      );
    }, containerRef);

    return () => {
      context.revert();
    };
  }, [preparedData.length, reloadKey]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || preparedData.length === 0) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      chart.update();
      return;
    }

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        chart.update("none");
        rafId = null;
      });
    };

    const animatedDatasets = chart.data.datasets.map(dataset => {
      const targetValues = (dataset.data as number[]).map(value =>
        safeNumber(value)
      );
      return {
        dataset,
        targetValues,
        proxies: targetValues.map(() => ({ value: 0 })),
      };
    });

    animatedDatasets.forEach(({ dataset, targetValues }) => {
      dataset.data = targetValues.map(() => 0);
    });
    chart.update("none");

    const timeline = gsap.timeline();

    animatedDatasets.forEach((set, datasetIndex) => {
      set.proxies.forEach((proxy, pointIndex) => {
        timeline.to(
          proxy,
          {
            value: set.targetValues[pointIndex],
            duration: 0.74,
            ease: "elastic.out(1,0.62)",
            onUpdate: () => {
              (set.dataset.data as number[])[pointIndex] = Number(
                proxy.value.toFixed(2)
              );
              scheduleUpdate();
            },
          },
          datasetIndex * 0.08 + pointIndex * 0.04
        );
      });
    });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      timeline.kill();
    };
  }, [chartData, preparedData.length]);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/92 backdrop-blur-xl">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-rose-400/35 bg-rose-950/25 p-5 text-sm text-rose-200">
        {errorMessage}
      </div>
    );
  }

  if (preparedData.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/92 p-6 text-center text-slate-400 backdrop-blur-xl">
        No hay datos de ventas para graficar en este periodo.
      </div>
    );
  }

  const chartHeight = isCompactScreen ? 250 : 320;
  const minChartWidth = isCompactScreen
    ? 0
    : Math.max(640, preparedData.length * 58);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-slate-200/10 bg-[#0A0A0A]/92 p-5 shadow-[0_24px_90px_rgba(2,6,23,0.5)] backdrop-blur-xl"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            {title || "Rendimiento Cinemático"}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Barras de volumen + curvas de desempeño con entrada escalonada.
          </p>
        </div>

        {(!canShowAdminFinancials || !canShowOwnEarnings) && (
          <div className="flex items-center gap-2">
            <ConfidentialBadge compact label="Blindaje Activo" />
            <span className="rounded-full border border-slate-300/25 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300 blur-[1.6px]">
              Margen Interno
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto touch-pan-x [-webkit-overflow-scrolling:touch]">
        <div
          className="w-full"
          style={{
            height: `${chartHeight}px`,
            minWidth: minChartWidth > 0 ? `${minChartWidth}px` : "100%",
          }}
        >
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1">
          Pico de volumen resaltado con glow
        </span>
        <span className="rounded-full border border-blue-300/30 bg-blue-500/10 px-2 py-1">
          Stagger elástico punto por punto
        </span>
      </div>
    </div>
  );
};
