import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import { advancedAnalyticsService } from "../../features/analytics/services";
import { ConfidentialBadge } from "../../shared/components/ui";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type MetricMode = "quantity" | "ownProfit" | "revenue";

interface ProductDatum {
  productId?: string;
  _id?: string;
  name?: string;
  product?: {
    name?: string;
    category?: { name?: string } | string;
  };
  category?: { name?: string } | string;
  totalQuantity?: number;
  quantity?: number;
  salesCount?: number;
  totalRevenue?: number;
  revenue?: number;
  totalProfit?: number;
  profit?: number;
}

interface TopProductsChartProps {
  limit?: number;
  startDate?: string;
  endDate?: string;
  reloadKey?: number;
  data?: ProductDatum[];
  metricMode?: MetricMode;
  hideFinancialData?: boolean;
  showOwnEmployeeEarnings?: boolean;
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

const normalizeCategory = (category: ProductDatum["category"]) => {
  if (typeof category === "string") {
    return category;
  }
  if (category && typeof category === "object" && category.name) {
    return category.name;
  }
  return "Sin categoría";
};

export const TopProductsChart: React.FC<TopProductsChartProps> = ({
  limit = 10,
  startDate,
  endDate,
  reloadKey = 0,
  data,
  metricMode = "quantity",
  hideFinancialData = false,
  showOwnEmployeeEarnings,
  showAdminFinancials,
  title,
}) => {
  const [fetchedData, setFetchedData] = useState<ProductDatum[]>([]);
  const [loading, setLoading] = useState(!data);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const chartRef = useRef<ChartJS<"bar"> | null>(null);
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

        const response = await advancedAnalyticsService.getTopProducts({
          limit,
          startDate,
          endDate,
          sortBy:
            metricMode === "quantity"
              ? "quantity"
              : metricMode === "revenue"
                ? "revenue"
                : "profit",
        });

        if (!isActive) return;

        const products = Array.isArray(response.topProducts)
          ? response.topProducts
          : [];
        setFetchedData(products);
      } catch {
        if (!isActive) return;
        setErrorMessage("No fue posible cargar el ranking de productos.");
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
  }, [endDate, limit, metricMode, reloadKey, shouldFetch, startDate]);

  const sourceData = data ?? fetchedData;
  const canShowOwnEarnings = showOwnEmployeeEarnings ?? !hideFinancialData;
  const canShowAdminFinancials =
    (showAdminFinancials ?? !hideFinancialData) && !hideFinancialData;

  const preparedData = useMemo(() => {
    return (sourceData || [])
      .filter(Boolean)
      .map(item => {
        const productName = item.name || item.product?.name || "Producto";
        const category = normalizeCategory(
          item.category || item.product?.category
        );

        return {
          id: item.productId || item._id || productName,
          name: productName,
          category,
          quantity: safeNumber(
            item.totalQuantity ?? item.quantity ?? item.salesCount
          ),
          revenue: safeNumber(item.totalRevenue ?? item.revenue),
          ownProfit: safeNumber(item.totalProfit ?? item.profit),
        };
      })
      .slice(0, limit);
  }, [limit, sourceData]);

  const effectiveMetric: MetricMode =
    metricMode === "revenue" && !canShowAdminFinancials
      ? "quantity"
      : metricMode === "ownProfit" && !canShowOwnEarnings
        ? "quantity"
        : metricMode;

  const values = useMemo(() => {
    if (effectiveMetric === "revenue") {
      return preparedData.map(item => item.revenue);
    }
    if (effectiveMetric === "ownProfit") {
      return preparedData.map(item => item.ownProfit);
    }
    return preparedData.map(item => item.quantity);
  }, [effectiveMetric, preparedData]);

  const labels = useMemo(
    () => preparedData.map(item => item.name),
    [preparedData]
  );

  const topIndices = useMemo(() => {
    const ordered = values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map(item => item.index);
    return new Set(ordered);
  }, [values]);

  const metricLabel =
    effectiveMetric === "quantity"
      ? "Unidades"
      : effectiveMetric === "revenue"
        ? "Ingresos"
        : "Ganancia neta";

  const chartData = useMemo<ChartData<"bar">>(() => {
    return {
      labels,
      datasets: [
        {
          label: metricLabel,
          data: values,
          borderRadius: 10,
          borderSkipped: false,
          backgroundColor: values.map((_, index) => {
            if (index === 0) {
              return "rgba(56,189,248,0.76)";
            }
            if (topIndices.has(index)) {
              return "rgba(125,211,252,0.52)";
            }
            return "rgba(56,189,248,0.28)";
          }),
          borderColor: values.map((_, index) => {
            if (index === 0) {
              return "rgba(186,230,253,0.98)";
            }
            if (topIndices.has(index)) {
              return "rgba(125,211,252,0.85)";
            }
            return "rgba(56,189,248,0.5)";
          }),
          borderWidth: 1,
          barThickness: 16,
          maxBarThickness: 22,
        },
      ],
    };
  }, [labels, metricLabel, topIndices, values]);

  const chartOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      elements: {
        point: {
          radius: isCompactScreen ? 2 : 3,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(2,6,23,0.92)",
          borderColor: "rgba(148,163,184,0.35)",
          borderWidth: 1,
          titleColor: "rgba(248,250,252,0.95)",
          bodyColor: "rgba(226,232,240,0.92)",
          callbacks: {
            label: item => {
              const value = safeNumber(item.parsed.x);
              if (
                effectiveMetric === "revenue" ||
                effectiveMetric === "ownProfit"
              ) {
                return `${metricLabel}: ${formatCurrency(value)}`;
              }
              return `${metricLabel}: ${value.toLocaleString("es-CO")}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "rgba(148,163,184,0.88)",
            autoSkip: true,
            maxTicksLimit: isSmallScreen ? 4 : isCompactScreen ? 5 : 8,
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: isSmallScreen ? 10 : 11,
            },
            callback: value => {
              const numeric = safeNumber(value);
              if (
                effectiveMetric === "revenue" ||
                effectiveMetric === "ownProfit"
              ) {
                if (numeric >= 1000000)
                  return `${(numeric / 1000000).toFixed(1)}M`;
                if (numeric >= 1000) return `${(numeric / 1000).toFixed(0)}K`;
              }
              return numeric;
            },
          },
          grid: {
            color: "rgba(71,85,105,0.24)",
          },
        },
        y: {
          ticks: {
            color: "rgba(226,232,240,0.92)",
            autoSkip: true,
            maxTicksLimit: isSmallScreen ? 6 : 8,
            font: {
              size: isSmallScreen ? 10 : 11,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    }),
    [effectiveMetric, isCompactScreen, isSmallScreen, metricLabel]
  );

  useEffect(() => {
    if (!containerRef.current || preparedData.length === 0) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
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

    const dataset = chart.data.datasets[0];
    const targetValues = (dataset.data as number[]).map(value =>
      safeNumber(value)
    );
    const proxies = targetValues.map(() => ({ value: 0 }));

    dataset.data = targetValues.map(() => 0);
    chart.update("none");

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        chart.update("none");
        rafId = null;
      });
    };

    const timeline = gsap.timeline();
    proxies.forEach((proxy, index) => {
      timeline.to(
        proxy,
        {
          value: targetValues[index],
          duration: 0.76,
          ease: "elastic.out(1,0.64)",
          onUpdate: () => {
            (dataset.data as number[])[index] = Number(proxy.value.toFixed(2));
            scheduleUpdate();
          },
        },
        index * 0.06
      );
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
      <div className="bg-[#0A0A0A]/92 flex h-80 items-center justify-center rounded-2xl border border-slate-200/10 backdrop-blur-xl">
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
      <div className="bg-[#0A0A0A]/92 rounded-2xl border border-slate-200/10 p-6 text-center text-slate-400 backdrop-blur-xl">
        No hay productos para mostrar en el ranking.
      </div>
    );
  }

  const chartHeight = isCompactScreen
    ? 250
    : Math.max(320, preparedData.length * 44);

  return (
    <div
      ref={containerRef}
      className="bg-[#0A0A0A]/92 rounded-2xl border border-slate-200/10 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            {title || `Top ${limit} Productos`}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Barras elásticas con glow para máximos de rendimiento.
          </p>
        </div>

        {((metricMode === "revenue" && !canShowAdminFinancials) ||
          (metricMode === "ownProfit" && !canShowOwnEarnings)) && (
          <ConfidentialBadge compact label="Métrica Blindada" />
        )}
      </div>

      <div
        className="h-full w-full"
        style={{
          height: `${chartHeight}px`,
          minHeight: `${chartHeight}px`,
        }}
      >
        <Bar ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        {preparedData.slice(0, 4).map((item, index) => {
          const metricValue =
            effectiveMetric === "revenue"
              ? formatCurrency(item.revenue)
              : effectiveMetric === "ownProfit"
                ? formatCurrency(item.ownProfit)
                : item.quantity.toLocaleString("es-CO");

          return (
            <div
              key={`${item.id}-${index}`}
              className="flex items-center justify-between rounded-xl border border-slate-300/10 bg-slate-900/55 px-3 py-2"
            >
              <span className="truncate pr-2">{item.name}</span>
              <span className="font-semibold text-cyan-200">{metricValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
