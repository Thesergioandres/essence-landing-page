import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { m as motion } from "framer-motion";
import {
  BarChart3,
  Download,
  FileText,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useFeature } from "../../../components/FeatureSection";
import InfoTooltip from "../../../components/InfoTooltip";
import ProfitHistoryView from "../../../components/analytics/ProfitHistoryView";
import {
  CategoryDistributionChart,
  ComparativeAnalysisView,
  EmployeeRankingsTable,
  FinancialKPICards,
  LowStockAlertsVisual,
  SalesTimelineChart,
  TopProductsChart,
} from "../../../components/charts";
import { formatCurrency } from "../../../utils";
import {
  exportKPIsToPDF,
  exportRankingsToExcel,
  exportRankingsToPDF,
} from "../../../utils/exportUtils";
import {
  advancedAnalyticsService,
  analyticsService,
} from "../../analytics/services";
import { useFinancialPrivacy } from "../../auth/utils/financialPrivacy";
import { expenseService } from "../../common/services";
import type { Expense } from "../../common/types/common.types";
import { creditService } from "../../credits/services";
import type { CreditMetrics } from "../../credits/types/credit.types";
import { stockService } from "../../inventory/services/inventory.service";
import { saleService } from "../../sales/services/sales.service";

export default function AdvancedDashboard() {
  const { hideFinancialData } = useFinancialPrivacy();
  // Feature flags
  const employeesEnabled = useFeature("employees");
  const creditsEnabled = useFeature("credits");

  const [overviewRange, setOverviewRange] = useState({
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [timelineRange, setTimelineRange] = useState({
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [timelinePeriod, setTimelinePeriod] = useState<
    "day" | "week" | "month"
  >("day");
  const [productsRange, setProductsRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [employeesRange, setEmployeesRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [topProductsLimit, setTopProductsLimit] = useState(10);
  const [rankingLimit, setRankingLimit] = useState(10);
  const [rankingSearch, setRankingSearch] = useState("");

  const [salesFunnel, setSalesFunnel] = useState<{
    pending: { count: number; totalValue: number };
    confirmed: { count: number; totalValue: number };
    conversionRate: number;
  } | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);

  // Créditos y Gastos
  const [creditMetrics, setCreditMetrics] = useState<CreditMetrics | null>(
    null
  );
  const [creditLoading, setCreditLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseMetrics, setExpenseMetrics] = useState({
    total: 0,
    thisMonth: 0,
    lastMonth: 0,
    byCategory: [] as { type: string; amount: number }[],
  });

  const [rotationDays, setRotationDays] = useState(30);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [productRotation, setProductRotation] = useState<
    {
      _id: string;
      name: string;
      totalSold: number;
      frequency: number;
      currentStock: number;
      rotationRate: number;
    }[]
  >([]);

  const validateRange = (range: { startDate: string; endDate: string }) => {
    if (!range.startDate || !range.endDate) return null;
    return range.startDate > range.endDate
      ? "La fecha inicio no puede ser mayor que la fecha fin."
      : null;
  };

  const isSameRange = (
    range: { startDate: string; endDate: string },
    days: number
  ) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const start = format(subDays(new Date(), days), "yyyy-MM-dd");
    return range.startDate === start && range.endDate === today;
  };

  const isCurrentMonthRange = (range: {
    startDate: string;
    endDate: string;
  }) => {
    const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
    return range.startDate === start && range.endDate === end;
  };

  const rangeBtn = (active: boolean) =>
    `${active ? "border-purple-500 bg-purple-500/10 text-white" : "border-gray-700 text-gray-100"} rounded-md border px-3 py-2 text-sm transition hover:border-purple-500`;

  const applyQuickRange = (
    setter: (r: { startDate: string; endDate: string }) => void,
    days: number
  ) => {
    setter({
      startDate: format(subDays(new Date(), days), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    });
  };

  const applyCurrentMonth = (
    setter: (r: { startDate: string; endDate: string }) => void
  ) => {
    setter({
      startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    });
  };

  const clearRange = (
    setter: (r: { startDate: string; endDate: string }) => void
  ) => setter({ startDate: "", endDate: "" });

  const handleReload = () => {
    setReloadKey(key => key + 1);
  };

  const [deferHeavy, setDeferHeavy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDeferHeavy(true), 350);
    return () => clearTimeout(t);
  }, []);

  const overviewRangeError = validateRange(overviewRange);
  const timelineRangeError = validateRange(timelineRange);
  const productsRangeError = validateRange(productsRange);
  const employeesRangeError = validateRange(employeesRange);

  useEffect(() => {
    if (hideFinancialData) {
      setSalesFunnel(null);
      setFunnelLoading(false);
      return;
    }

    const fetchFunnel = async () => {
      try {
        setFunnelLoading(true);
        const response = await advancedAnalyticsService.getSalesFunnel({
          startDate: overviewRange.startDate || undefined,
          endDate: overviewRange.endDate || undefined,
        });
        const rawFunnel = (response as any)?.funnel;
        if (rawFunnel && !Array.isArray(rawFunnel)) {
          setSalesFunnel({
            pending: {
              count: Number(rawFunnel.pending?.count) || 0,
              totalValue: Number(rawFunnel.pending?.totalValue) || 0,
            },
            confirmed: {
              count: Number(rawFunnel.confirmed?.count) || 0,
              totalValue: Number(rawFunnel.confirmed?.totalValue) || 0,
            },
            conversionRate: Number(rawFunnel.conversionRate) || 0,
          });
        } else {
          setSalesFunnel({
            pending: { count: 0, totalValue: 0 },
            confirmed: { count: 0, totalValue: 0 },
            conversionRate: 0,
          });
        }
      } catch (error) {
        console.error("Error al cargar funnel:", error);
        setSalesFunnel(null);
      } finally {
        setFunnelLoading(false);
      }
    };

    if (!validateRange(overviewRange)) {
      fetchFunnel();
    }
  }, [overviewRange, reloadKey, hideFinancialData]);

  useEffect(() => {
    if (hideFinancialData) {
      setProductRotation([]);
      setRotationLoading(false);
      return;
    }

    const fetchRotation = async () => {
      try {
        setRotationLoading(true);
        const response = await advancedAnalyticsService.getProductRotation({
          days: rotationDays,
        } as any);
        setProductRotation(
          ((response as any).productRotation ||
            (response as any).products ||
            []) as any
        );
      } catch (error) {
        console.error("Error al cargar rotación de productos:", error);
        setProductRotation([]);
      } finally {
        setRotationLoading(false);
      }
    };

    fetchRotation();
    // }
  }, [rotationDays, reloadKey, hideFinancialData]);

  // Cargar métricas de créditos
  useEffect(() => {
    if (hideFinancialData) {
      setCreditMetrics(null);
      setCreditLoading(false);
      return;
    }

    const fetchCredits = async () => {
      try {
        setCreditLoading(true);
        const response = await creditService.getMetrics();
        setCreditMetrics(response);
      } catch (error) {
        console.error("Error al cargar métricas de créditos:", error);
        setCreditMetrics(null);
      } finally {
        setCreditLoading(false);
      }
    };

    if (creditsEnabled) {
      fetchCredits();
    }
  }, [reloadKey, creditsEnabled, hideFinancialData]);

  // Cargar gastos
  useEffect(() => {
    if (hideFinancialData) {
      setExpenses([]);
      setExpenseMetrics({
        total: 0,
        thisMonth: 0,
        lastMonth: 0,
        byCategory: [],
      });
      setExpenseLoading(false);
      return;
    }

    const fetchExpenses = async () => {
      try {
        setExpenseLoading(true);
        const response = await expenseService.getAll();
        // RULE: Exclude "Costo de Venta" from dashboard logic (prevents double counting)
        const expenseList = (response.expenses || []).filter(
          (e: Expense) => e.category?.toLowerCase() !== "costo de venta"
        );
        setExpenses(expenseList);

        // Calcular métricas
        const now = new Date();

        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear =
          currentMonth === 0 ? currentYear - 1 : currentYear;

        const thisMonthTotal = expenseList
          .filter((e: Expense) => {
            const d = new Date(e.expenseDate);
            return (
              d.getMonth() === currentMonth && d.getFullYear() === currentYear
            );
          })
          .reduce(
            (sum: number, e: Expense) => sum + (Number(e.amount) || 0),
            0
          );

        const lastMonthTotal = expenseList
          .filter((e: Expense) => {
            const d = new Date(e.expenseDate);
            return (
              d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
            );
          })
          .reduce(
            (sum: number, e: Expense) => sum + (Number(e.amount) || 0),
            0
          );

        const total = expenseList.reduce(
          (sum: number, e: Expense) => sum + (Number(e.amount) || 0),
          0
        );

        // Agrupar por categoría
        const byType = expenseList.reduce<Record<string, number>>(
          (acc, e: Expense) => {
            const type = e.type || e.category || e.description || "Otros";
            acc[type] = (acc[type] || 0) + (Number(e.amount) || 0);
            return acc;
          },
          {}
        );

        const byCategory = Object.entries(byType)
          .map(([type, amount]) => ({ type, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setExpenseMetrics({
          total,
          thisMonth: thisMonthTotal,
          lastMonth: lastMonthTotal,
          byCategory,
        });
      } catch (error) {
        console.error("Error al cargar gastos:", error);
        setExpenses([]);
      } finally {
        setExpenseLoading(false);
      }
    };

    fetchExpenses();
  }, [reloadKey, hideFinancialData]);

  const handleExportKPIs = async () => {
    try {
      const response = await advancedAnalyticsService.getFinancialKPIs({
        startDate: overviewRange.startDate || undefined,
        endDate: overviewRange.endDate || undefined,
      });
      exportKPIsToPDF(response.kpis || response);
    } catch (error) {
      console.error("Error al exportar KPIs:", error);
    }
  };

  const handleExportRankings = async (format: "pdf" | "excel") => {
    try {
      const response = await advancedAnalyticsService.getEmployeeRankings({
        startDate: employeesRange.startDate || undefined,
        endDate: employeesRange.endDate || undefined,
      });

      if (format === "pdf") {
        exportRankingsToPDF(response.rankings);
      } else {
        exportRankingsToExcel(response.rankings);
      }
    } catch (error) {
      console.error("Error al exportar rankings:", error);
    }
  };

  // State for export loading
  const [isExporting, setIsExporting] = useState(false);
  const [isMasterExporting, setIsMasterExporting] = useState(false);
  const [masterExportNotice, setMasterExportNotice] = useState("");
  const [masterExportError, setMasterExportError] = useState("");
  const [fullExportData, setFullExportData] = useState<unknown>(null);
  const [fullExportError, setFullExportError] = useState("");

  const appendSheet = (
    workbook: any,
    XLSX: any,
    sheetName: string,
    rows: Array<Record<string, unknown>>
  ) => {
    const hasRows = Array.isArray(rows) && rows.length > 0;
    const data = hasRows ? rows : [{ Info: "Sin datos disponibles" }];
    const worksheet = XLSX.utils.json_to_sheet(data);

    const headers = Object.keys(data[0] || {});
    worksheet["!cols"] = headers.map(header => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => String((row as any)[header] || "").length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 12), 40) };
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  };

  const handleExportMasterExcel = async () => {
    try {
      setIsMasterExporting(true);
      setMasterExportNotice("");
      setMasterExportError("");

      const [
        salesResponse,
        inventoryResponse,
        employeePerf,
        expensesResult,
      ] = await Promise.all([
        saleService.getAllSales({
          startDate: overviewRange.startDate || undefined,
          endDate: overviewRange.endDate || undefined,
          limit: 5000,
        }),
        stockService.getGlobalInventory(),
        analyticsService.getProfitByEmployee({
          startDate: employeesRange.startDate || undefined,
          endDate: employeesRange.endDate || undefined,
        }),
        expenses.length > 0
          ? Promise.resolve({ expenses })
          : expenseService.getAll(),
      ]);

      const salesRows = (salesResponse?.sales || []).map(sale => {
        const quantity = Number(sale.quantity || 0);
        const unitPrice = Number(sale.salePrice || 0);
        const revenue = quantity * unitPrice;
        const profit = Number(
          sale.netProfit ?? sale.totalProfit ?? sale.adminProfit ?? 0
        );
        const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

        return {
          Fecha: sale.saleDate
            ? format(new Date(sale.saleDate), "yyyy-MM-dd")
            : "",
          Venta: sale.saleId || sale._id,
          Grupo: sale.saleGroupId || "-",
          Producto:
            typeof sale.product === "object" && sale.product !== null
              ? sale.product.name
              : sale.productName || "Sin producto",
          Cantidad: quantity,
          "Precio Unitario": unitPrice,
          Ingreso: revenue,
          "Profit Neto": profit,
          "Margen %": Number(marginPct.toFixed(2)),
          Ubicacion: sale.sourceLocation || "-",
          Estado: sale.paymentStatus || "-",
        };
      });

      const inventoryRows = ((inventoryResponse as any)?.inventory || []).map(
        (item: any) => {
          const productName =
            item?.product?.name ||
            item?.name ||
            item?.productName ||
            "Sin producto";
          const warehouse = Number(
            item?.warehouse || item?.warehouseStock || 0
          );
          const branchTotal = Array.isArray(item?.branches)
            ? item.branches.reduce(
                (sum: number, branchItem: any) =>
                  sum + Number(branchItem?.quantity || branchItem?.stock || 0),
                0
              )
            : Number(item?.branches || item?.branchStock || 0);
          const employees = Number(
            item?.employees || item?.employeeStock || 0
          );
          const total = Number(
            item?.total || warehouse + branchTotal + employees
          );
          const branchDetail = Array.isArray(item?.branches)
            ? item.branches
                .map(
                  (branchItem: any) =>
                    `${branchItem?.branch?.name || branchItem?.name || "Sede"}: ${Number(branchItem?.quantity || branchItem?.stock || 0)}`
                )
                .join(" | ")
            : "";

          return {
            Producto: productName,
            Bodega: warehouse,
            Sedes: branchTotal,
            Employees: employees,
            Total: total,
            "Detalle Sedes": branchDetail,
          };
        }
      );

      const expenseRows = ((expensesResult as any)?.expenses || []).map(
        (expense: Expense) => {
          const type = expense.type || expense.category || "Otros";
          const description = expense.description || "";
          const isWarrantyLoss = /garant|defect|p[eé]rdida/i.test(
            `${type} ${description}`
          );
          return {
            Fecha: expense.expenseDate
              ? format(new Date(expense.expenseDate), "yyyy-MM-dd")
              : "",
            Tipo: type,
            Descripcion: description,
            Monto: Number(expense.amount || 0),
            "Perdida Garantia": isWarrantyLoss ? "SI" : "NO",
          };
        }
      );

      const employeeRows = (employeePerf?.employees || []).map(
        dist => ({
          Employee: dist.employeeName || "Sin nombre",
          "Total Ventas": Number(dist.totalSales || 0),
          Ingresos: Number(dist.totalRevenue || 0),
          "Profit Total": Number(dist.totalProfit || 0),
          "Profit Admin": Number(dist.adminProfit || 0),
          "Profit Employee": Number(dist.employeeProfit || 0),
        })
      );

      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      appendSheet(workbook, XLSX, "Ventas Totales", salesRows);
      appendSheet(workbook, XLSX, "Inventario Actual", inventoryRows);
      appendSheet(workbook, XLSX, "Gastos y Garantias", expenseRows);
      appendSheet(workbook, XLSX, "Employees", employeeRows);

      XLSX.writeFile(
        workbook,
        `Reporte_Maestro_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`
      );
      setMasterExportNotice(
        "Reporte maestro generado y descargado correctamente."
      );
      setTimeout(() => setMasterExportNotice(""), 3500);
    } catch (error) {
      console.error("Error al exportar Reporte Maestro:", error);
      setMasterExportError(
        "No se pudo generar el Reporte Maestro. Verifica conexion y permisos."
      );
    } finally {
      setIsMasterExporting(false);
    }
  };

  /**
   * Export full business data as JSON backup
   */
  const handleExportFullData = async () => {
    try {
      setIsExporting(true);
      setFullExportError("");
      const data = await analyticsService.getFullDataExport();
      setFullExportData(data);

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_empresa_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al exportar datos:", error);
      setFullExportError(
        "No se pudo cargar la informacion completa de la empresa. Revisa tu conexion o permisos."
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (hideFinancialData) {
    return (
      <div className="min-h-screen bg-gray-950 p-6 md:p-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Panel Privado</h1>
            <p className="text-gray-400">
              Solo se muestra tu volumen de ventas para proteger datos
              financieros globales.
            </p>
          </div>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-gray-300 transition hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <section className="space-y-6 rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Línea de tiempo de ventas
              </h3>
              <p className="text-sm text-gray-400">
                Vista individual de volumen sin montos financieros globales.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={timelinePeriod}
                onChange={e =>
                  setTimelinePeriod(e.target.value as "day" | "week" | "month")
                }
                className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
              >
                <option value="day">Diario</option>
                <option value="week">Semanal</option>
                <option value="month">Mensual</option>
              </select>
              <input
                type="date"
                value={timelineRange.startDate}
                onChange={e =>
                  setTimelineRange({
                    ...timelineRange,
                    startDate: e.target.value,
                  })
                }
                className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
              />
              <input
                type="date"
                value={timelineRange.endDate}
                onChange={e =>
                  setTimelineRange({
                    ...timelineRange,
                    endDate: e.target.value,
                  })
                }
                className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
              />
              <button
                onClick={() => applyQuickRange(setTimelineRange, 7)}
                className={rangeBtn(isSameRange(timelineRange, 7))}
              >
                7d
              </button>
              <button
                onClick={() => applyQuickRange(setTimelineRange, 30)}
                className={rangeBtn(isSameRange(timelineRange, 30))}
              >
                30d
              </button>
              <button
                onClick={() => applyQuickRange(setTimelineRange, 90)}
                className={rangeBtn(isSameRange(timelineRange, 90))}
              >
                90d
              </button>
            </div>
          </div>

          {timelineRangeError && (
            <p className="mb-2 text-sm text-red-300">{timelineRangeError}</p>
          )}

          <SalesTimelineChart
            period={timelinePeriod}
            startDate={timelineRange.startDate || undefined}
            endDate={timelineRange.endDate || undefined}
            reloadKey={reloadKey}
            hideFinancialData
          />
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Panel Avanzado</h1>
          <p className="text-gray-400">
            Análisis detallado de métricas, inventario y finanzas
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportMasterExcel}
            disabled={isMasterExporting}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isMasterExporting
              ? "Generando..."
              : "📥 Descargar Reporte Maestro (Excel)"}
          </button>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-gray-300 transition hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            onClick={handleExportFullData}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting
              ? "Exportando..."
              : "📥 Exportar Backup Completo (JSON)"}
          </button>
        </div>
      </div>
      {fullExportError && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-300">
          {fullExportError}
        </div>
      )}
      {masterExportError && (
        <div className="rounded-lg border border-rose-500 bg-rose-500/10 p-4 text-sm text-rose-300">
          {masterExportError}
        </div>
      )}
      {masterExportNotice && (
        <div className="rounded-lg border border-emerald-500 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {masterExportNotice}
        </div>
      )}
      {fullExportData && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-emerald-200">
              Informacion completa de la empresa
            </h2>
            <button
              type="button"
              onClick={() => setFullExportData(null)}
              className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
            >
              Cerrar
            </button>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-lg bg-black/40 p-4 text-xs text-emerald-100">
            {JSON.stringify(fullExportData, null, 2)}
          </pre>
        </div>
      )}
      <div className="space-y-12">
        {/* === SECCIÓN 1: VISTA GENERAL === */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
            <BarChart3 className="h-6 w-6 text-purple-500" />
            <h2 className="text-2xl font-bold text-white">Vista General</h2>
          </div>
          <div className="space-y-8">
            {/* Filtros Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gray-800 bg-gray-900/70 p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha inicio (KPIs / Embudo)
                    </label>
                    <input
                      type="date"
                      value={overviewRange.startDate}
                      onChange={e =>
                        setOverviewRange({
                          ...overviewRange,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={overviewRange.endDate}
                      onChange={e =>
                        setOverviewRange({
                          ...overviewRange,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500/40 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 7)}
                    className={rangeBtn(isSameRange(overviewRange, 7))}
                  >
                    Últimos 7 días
                  </button>
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 30)}
                    className={rangeBtn(isSameRange(overviewRange, 30))}
                  >
                    Últimos 30 días
                  </button>
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 90)}
                    className={rangeBtn(isSameRange(overviewRange, 90))}
                  >
                    Últimos 90 días
                  </button>
                  <button
                    onClick={() => applyCurrentMonth(setOverviewRange)}
                    className={rangeBtn(isCurrentMonthRange(overviewRange))}
                  >
                    Mes actual
                  </button>
                  <button
                    onClick={() => clearRange(setOverviewRange)}
                    className={rangeBtn(
                      !overviewRange.startDate && !overviewRange.endDate
                    )}
                  >
                    Todo
                  </button>
                  <button
                    onClick={handleExportKPIs}
                    className="flex items-center gap-2 rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-300 transition hover:bg-purple-500/20"
                  >
                    <Download className="h-4 w-4" />
                    KPIs
                  </button>
                </div>
              </div>
              {overviewRangeError && (
                <p className="mt-3 text-sm text-red-300">
                  {overviewRangeError}
                </p>
              )}
            </motion.div>

            {/* KPIs */}
            <FinancialKPICards
              reloadKey={reloadKey}
              startDate={overviewRange.startDate || undefined}
              endDate={overviewRange.endDate || undefined}
            />

            {/* Comparative Analysis */}
            <ComparativeAnalysisView reloadKey={reloadKey} />

            {/* Sales Funnel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-lg border border-gray-800 bg-gray-900 p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  Embudo de pagos
                </h3>
                <span className="text-sm text-gray-400">
                  {overviewRange.startDate && overviewRange.endDate
                    ? `${overviewRange.startDate} → ${overviewRange.endDate}`
                    : "Global"}
                </span>
              </div>

              {funnelLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600"></div>
                </div>
              ) : !salesFunnel ? (
                <div className="text-gray-400">
                  No hay datos del embudo disponibles.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-950/20 p-4">
                    <p className="text-sm text-gray-400">
                      Pendientes
                      <InfoTooltip text="Ventas registradas que aun no se confirman o cobran." />
                    </p>
                    <p className="text-2xl font-bold text-yellow-300">
                      {salesFunnel.pending.count}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatCurrency(salesFunnel.pending.totalValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/20 p-4">
                    <p className="text-sm text-gray-400">
                      Confirmadas
                      <InfoTooltip text="Ventas confirmadas en el periodo." />
                    </p>
                    <p className="text-2xl font-bold text-green-300">
                      {salesFunnel.confirmed.count}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatCurrency(salesFunnel.confirmed.totalValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/20 p-4">
                    <p className="text-sm text-gray-400">
                      Conversión
                      <InfoTooltip text="Porcentaje de confirmadas frente al total." />
                    </p>
                    <p className="text-2xl font-bold text-purple-300">
                      {salesFunnel.conversionRate.toFixed(2)}%
                    </p>
                    <p className="text-sm text-gray-400">Confirmadas / Total</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sales Timeline */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Línea de tiempo de ventas
                  </h3>
                  <p className="text-sm text-gray-400">
                    Ajusta periodo y rango solo para esta vista.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={timelinePeriod}
                    onChange={e =>
                      setTimelinePeriod(
                        e.target.value as "day" | "week" | "month"
                      )
                    }
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  >
                    <option value="day">Diario</option>
                    <option value="week">Semanal</option>
                    <option value="month">Mensual</option>
                  </select>
                  <input
                    type="date"
                    value={timelineRange.startDate}
                    onChange={e =>
                      setTimelineRange({
                        ...timelineRange,
                        startDate: e.target.value,
                      })
                    }
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  />
                  <input
                    type="date"
                    value={timelineRange.endDate}
                    onChange={e =>
                      setTimelineRange({
                        ...timelineRange,
                        endDate: e.target.value,
                      })
                    }
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  />
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 7)}
                    className={rangeBtn(isSameRange(timelineRange, 7))}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 14)}
                    className={rangeBtn(isSameRange(timelineRange, 14))}
                  >
                    14d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 30)}
                    className={rangeBtn(isSameRange(timelineRange, 30))}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setTimelineRange, 90)}
                    className={rangeBtn(isSameRange(timelineRange, 90))}
                  >
                    90d
                  </button>
                </div>
              </div>
              {timelineRangeError && (
                <p className="mb-2 text-sm text-red-300">
                  {timelineRangeError}
                </p>
              )}
              <SalesTimelineChart
                period={timelinePeriod}
                startDate={timelineRange.startDate || undefined}
                endDate={timelineRange.endDate || undefined}
                reloadKey={reloadKey}
              />
            </div>

            {/* SECCIÓN MERGEADA: CRÉDITOS */}
            {creditsEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-linear-to-br rounded-xl border border-amber-700/30 from-amber-900/20 to-gray-900/70 p-6"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-amber-300">
                      💳 Cartera de Créditos
                    </h3>
                    <p className="text-sm text-gray-400">
                      Análisis completo de tu cartera de fiados
                    </p>
                  </div>
                </div>

                {creditLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-500" />
                  </div>
                ) : !creditMetrics ? (
                  <div className="py-10 text-center text-gray-400">
                    No hay datos de créditos disponibles.
                  </div>
                ) : (
                  <>
                    {/* KPIs de Créditos */}
                    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                        <p className="text-xs uppercase text-gray-400">
                          Total Créditos
                          <InfoTooltip text="Cantidad total de creditos registrados." />
                        </p>
                        <p className="mt-1 text-2xl font-bold text-white">
                          {creditMetrics.total.totalCredits}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                        <p className="text-xs uppercase text-gray-400">
                          Deuda Pendiente
                          <InfoTooltip text="Saldo pendiente por cobrar en creditos." />
                        </p>
                        <p className="mt-1 text-2xl font-bold text-red-400">
                          {formatCurrency(
                            creditMetrics.total.totalRemainingAmount
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                        <p className="text-xs uppercase text-gray-400">
                          Total Recuperado
                          <InfoTooltip text="Monto total pagado por los clientes." />
                        </p>
                        <p className="mt-1 text-2xl font-bold text-green-400">
                          {formatCurrency(creditMetrics.total.totalPaidAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                        <p className="text-xs uppercase text-gray-400">
                          Tasa Recuperación
                          <InfoTooltip text="Porcentaje recuperado sobre el total de creditos." />
                        </p>
                        <p
                          className={`mt-1 text-2xl font-bold ${Number(creditMetrics.recoveryRate) >= 50 ? "text-green-400" : "text-amber-400"}`}
                        >
                          {creditMetrics.total.totalCredits === 0
                            ? "100%"
                            : `${creditMetrics.recoveryRate}%`}
                        </p>
                      </div>
                    </div>

                    {/* Métricas de Mora */}
                    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="rounded-lg border border-red-700/30 bg-red-900/10 p-4">
                        <p className="text-sm font-medium text-red-300">
                          ⚠️ Créditos Vencidos
                          <InfoTooltip
                            text="Creditos con fecha vencida y saldo pendiente."
                            tone="danger"
                          />
                        </p>
                        <p className="mt-2 text-3xl font-bold text-red-400">
                          {creditMetrics.overdue.count}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          Monto: {formatCurrency(creditMetrics.overdue.amount)}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                        <p className="text-sm font-medium text-gray-300">
                          Indicador de Salud
                          <InfoTooltip text="Semaforo basado en la tasa de recuperacion." />
                        </p>
                        <div className="mt-3 flex items-center gap-4">
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-700">
                            <div
                              className="bg-linear-to-r h-full from-green-500 via-yellow-500 to-red-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  creditMetrics.total.totalCredits === 0
                                    ? 100
                                    : Number(creditMetrics.recoveryRate)
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-200">
                            {creditMetrics.total.totalCredits === 0
                              ? "✅ Excelente"
                              : Number(creditMetrics.recoveryRate) >= 70
                                ? "✅ Excelente"
                                : Number(creditMetrics.recoveryRate) >= 50
                                  ? "⚠️ Aceptable"
                                  : "❌ Crítico"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Top Deudores */}
                    {creditMetrics.topDebtors &&
                      creditMetrics.topDebtors.length > 0 && (
                        <div className="rounded-lg border border-amber-800/30 bg-gray-900/40 p-4">
                          <h4 className="mb-3 text-lg font-semibold text-amber-300">
                            🎯 Top Deudores
                          </h4>
                          <div className="overflow-hidden rounded-lg border border-amber-800/20">
                            <table className="w-full divide-y divide-amber-800/20">
                              <thead className="bg-amber-900/20">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-300/70">
                                    Cliente
                                    <InfoTooltip
                                      text="Cliente con deuda pendiente."
                                      tone="warning"
                                    />
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-300/70">
                                    Deuda Total
                                    <InfoTooltip
                                      text="Monto total adeudado por el cliente."
                                      tone="warning"
                                    />
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-300/70">
                                    Créditos
                                    <InfoTooltip
                                      text="Cantidad de creditos abiertos por el cliente."
                                      tone="warning"
                                    />
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-800/10">
                                {creditMetrics.topDebtors.map((debtor, idx) => (
                                  <tr
                                    key={debtor.customerId || idx}
                                    className="hover:bg-amber-900/10"
                                  >
                                    <td className="px-4 py-3 text-sm text-gray-100">
                                      {debtor.customerName}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-400">
                                      {formatCurrency(debtor.totalDebt)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                                      {debtor.creditsCount}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                  </>
                )}
              </motion.div>
            )}

            {/* SECCIÓN MERGEADA: GASTOS */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-linear-to-br rounded-xl border border-rose-700/30 from-rose-900/20 to-gray-900/70 p-6"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-rose-300">
                    💸 Análisis de Gastos
                  </h3>
                  <p className="text-sm text-gray-400">
                    Control y distribución de gastos operativos
                  </p>
                </div>
              </div>

              {expenseLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rose-500" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  No hay gastos registrados.
                </div>
              ) : (
                <>
                  {/* KPIs de Gastos */}
                  <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Este Mes
                        <InfoTooltip text="Gasto total registrado en el mes actual." />
                      </p>
                      <p className="mt-1 text-2xl font-bold text-rose-400">
                        {formatCurrency(expenseMetrics.thisMonth)}
                      </p>
                      {expenseMetrics.lastMonth > 0 && (
                        <p
                          className={`mt-1 text-xs ${expenseMetrics.thisMonth <= expenseMetrics.lastMonth ? "text-green-400" : "text-red-400"}`}
                        >
                          {expenseMetrics.thisMonth <= expenseMetrics.lastMonth
                            ? "↓"
                            : "↑"}
                          {Math.abs(
                            ((expenseMetrics.thisMonth -
                              expenseMetrics.lastMonth) /
                              expenseMetrics.lastMonth) *
                              100
                          ).toFixed(1)}
                          % vs anterior
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Mes Anterior
                        <InfoTooltip text="Gasto total registrado el mes anterior." />
                      </p>
                      <p className="mt-1 text-2xl font-bold text-amber-400">
                        {formatCurrency(expenseMetrics.lastMonth)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Total Histórico
                        <InfoTooltip text="Suma total de gastos registrados." />
                      </p>
                      <p className="mt-1 text-2xl font-bold text-purple-400">
                        {formatCurrency(expenseMetrics.total)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <p className="text-xs uppercase text-gray-400">
                        Promedio/Gasto
                        <InfoTooltip text="Promedio por cada gasto registrado." />
                      </p>
                      <p className="mt-1 text-2xl font-bold text-cyan-400">
                        {formatCurrency(
                          expenses.length > 0
                            ? expenseMetrics.total / expenses.length
                            : 0
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Distribución por Categoría */}
                  {expenseMetrics.byCategory.length > 0 && (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                      <h4 className="mb-4 text-lg font-semibold text-rose-300">
                        📊 Distribución por Categoría
                        <InfoTooltip
                          text="Participacion de cada categoria en el total de gastos."
                          tone="accent"
                          className="ml-2"
                        />
                      </h4>
                      <div className="space-y-3">
                        {expenseMetrics.byCategory.map((cat, idx) => {
                          const percentage =
                            (cat.amount / expenseMetrics.total) * 100;
                          return (
                            <div key={cat.type}>
                              <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="text-gray-200">
                                  {cat.type}
                                </span>
                                <span className="font-medium text-rose-300">
                                  {formatCurrency(cat.amount)} (
                                  {percentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                                <div
                                  className={`h-full transition-all ${
                                    idx === 0
                                      ? "bg-rose-500"
                                      : idx === 1
                                        ? "bg-amber-500"
                                        : idx === 2
                                          ? "bg-purple-500"
                                          : idx === 3
                                            ? "bg-cyan-500"
                                            : "bg-gray-500"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>
        </section>

        {/* === SECCIÓN 2: PRODUCTOS === */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
            <TrendingUp className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Productos</h2>
          </div>
          <div className="space-y-8">
            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha inicio (Productos)
                    </label>
                    <input
                      type="date"
                      value={productsRange.startDate}
                      onChange={e =>
                        setProductsRange({
                          ...productsRange,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={productsRange.endDate}
                      onChange={e =>
                        setProductsRange({
                          ...productsRange,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyQuickRange(setProductsRange, 7)}
                    className={rangeBtn(isSameRange(productsRange, 7))}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setProductsRange, 30)}
                    className={rangeBtn(isSameRange(productsRange, 30))}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setProductsRange, 90)}
                    className={rangeBtn(isSameRange(productsRange, 90))}
                  >
                    90d
                  </button>
                  <button
                    onClick={() => applyCurrentMonth(setProductsRange)}
                    className={rangeBtn(isCurrentMonthRange(productsRange))}
                  >
                    Mes actual
                  </button>
                  <button
                    onClick={() => clearRange(setProductsRange)}
                    className={rangeBtn(
                      !productsRange.startDate && !productsRange.endDate
                    )}
                  >
                    Todo
                  </button>
                  <select
                    value={topProductsLimit}
                    onChange={e => setTopProductsLimit(Number(e.target.value))}
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  >
                    {[5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>
                        Top {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {productsRangeError && (
                <p className="mt-2 text-sm text-red-300">
                  {productsRangeError}
                </p>
              )}
            </div>

            {/* Top Products */}
            <TopProductsChart
              limit={topProductsLimit}
              startDate={productsRange.startDate || undefined}
              endDate={productsRange.endDate || undefined}
              reloadKey={reloadKey}
            />

            {/* Category Distribution */}
            <CategoryDistributionChart
              startDate={productsRange.startDate || undefined}
              endDate={productsRange.endDate || undefined}
              reloadKey={reloadKey}
            />

            {/* Product Rotation */}
            {deferHeavy && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-lg border border-gray-800 bg-gray-900 p-6"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-xl font-bold text-white">
                    Rotación de productos
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRotationDays(7)}
                      className={`rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                        rotationDays === 7 ? "bg-gray-800" : ""
                      }`}
                    >
                      7 días
                    </button>
                    <button
                      onClick={() => setRotationDays(30)}
                      className={`rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                        rotationDays === 30 ? "bg-gray-800" : ""
                      }`}
                    >
                      30 días
                    </button>
                    <button
                      onClick={() => setRotationDays(90)}
                      className={`rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                        rotationDays === 90 ? "bg-gray-800" : ""
                      }`}
                    >
                      90 días
                    </button>
                  </div>
                </div>

                {rotationLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-600"></div>
                  </div>
                ) : productRotation.length === 0 ? (
                  <div className="text-gray-400">
                    No hay datos de rotación disponibles.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-900/50 text-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            Producto
                            <InfoTooltip text="Producto evaluado en el periodo." />
                          </th>
                          <th className="px-4 py-3 text-right">
                            Unidades
                            <InfoTooltip text="Unidades vendidas en el periodo." />
                          </th>
                          <th className="px-4 py-3 text-right">
                            Frecuencia
                            <InfoTooltip text="Numero de ventas donde aparecio el producto." />
                          </th>
                          <th className="px-4 py-3 text-right">
                            Stock
                            <InfoTooltip text="Stock actual disponible." />
                          </th>
                          <th className="px-4 py-3 text-right">
                            Rotación
                            <InfoTooltip text="Porcentaje de rotacion segun ventas y stock." />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 text-gray-200">
                        {productRotation.slice(0, 20).map(p => (
                          <tr key={p._id} className="hover:bg-gray-900/30">
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-100">
                                {p.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(p.totalSold) || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(p.frequency) || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(p.currentStock) || 0}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-purple-300">
                              {((Number(p.rotationRate) || 0) * 100).toFixed(1)}
                              %
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>

        {/* === SECCIÓN 3: HISTORIAL DE GANANCIA === */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
            <FileText className="h-6 w-6 text-green-500" />
            <h2 className="text-2xl font-bold text-white">
              Historial de Ganancia
            </h2>
          </div>
          <div className="space-y-8">
            {/* Tab: Historial Detallado */}

            <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Historial de Ganancias
                </h3>
                <p className="text-sm text-gray-400">
                  Desglose detallado de todas las transacciones financieras.
                </p>
              </div>
              {/* Reutilizamos los filtros de Overview para simplificar */}
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end">
                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={overviewRange.startDate}
                    onChange={e =>
                      setOverviewRange({
                        ...overviewRange,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={overviewRange.endDate}
                    onChange={e =>
                      setOverviewRange({
                        ...overviewRange,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyQuickRange(setOverviewRange, 30)}
                    className={rangeBtn(isSameRange(overviewRange, 30))}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => applyCurrentMonth(setOverviewRange)}
                    className={rangeBtn(isCurrentMonthRange(overviewRange))}
                  >
                    Mes
                  </button>
                </div>
              </div>

              <ProfitHistoryView
                dateRange={overviewRange}
                onDateRangeChange={setOverviewRange}
              />
            </div>
          </div>
        </section>

        {/* === SECCIÓN 4: EMPLOYEES === */}
        {employeesEnabled && (
          <section>
            <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
              <TrendingUp className="h-6 w-6 text-orange-500" />
              <h2 className="text-2xl font-bold text-white">Employees</h2>
            </div>
            <div className="space-y-8">
              <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha inicio (Employees)
                    </label>
                    <input
                      type="date"
                      value={employeesRange.startDate}
                      onChange={e =>
                        setEmployeesRange({
                          ...employeesRange,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={employeesRange.endDate}
                      onChange={e =>
                        setEmployeesRange({
                          ...employeesRange,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Buscar employee
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <input
                        type="text"
                        value={rankingSearch}
                        onChange={e => setRankingSearch(e.target.value)}
                        placeholder="Nombre o correo"
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-10 py-2 text-sm text-gray-100 focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => applyQuickRange(setEmployeesRange, 30)}
                    className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-500"
                  >
                    30d
                  </button>
                  <button
                    onClick={() => applyQuickRange(setEmployeesRange, 90)}
                    className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-500"
                  >
                    90d
                  </button>
                  <button
                    onClick={() => applyCurrentMonth(setEmployeesRange)}
                    className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-100 transition hover:border-purple-500"
                  >
                    Mes actual
                  </button>
                  <select
                    value={rankingLimit}
                    onChange={e => setRankingLimit(Number(e.target.value))}
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500"
                  >
                    {[5, 10, 15, 25].map(n => (
                      <option key={n} value={n}>
                        Top {n}
                      </option>
                    ))}
                  </select>
                </div>
                {employeesRangeError && (
                  <p className="mt-2 text-sm text-red-300">
                    {employeesRangeError}
                  </p>
                )}
              </div>

              {/* Export Buttons */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-end space-x-4"
              >
                <button
                  onClick={() => handleExportRankings("pdf")}
                  className="flex items-center rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </button>
                <button
                  onClick={() => handleExportRankings("excel")}
                  className="flex items-center rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </button>
              </motion.div>

              {/* Rankings */}
              {deferHeavy && (
                <EmployeeRankingsTable
                  startDate={employeesRange.startDate || undefined}
                  endDate={employeesRange.endDate || undefined}
                  limit={rankingLimit}
                  search={rankingSearch}
                  reloadKey={reloadKey}
                />
              )}
            </div>
          </section>
        )}

        {/* === SECCIÓN 5: INVENTARIO === */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
            <FileText className="h-6 w-6 text-red-500" />
            <h2 className="text-2xl font-bold text-white">Inventario</h2>
          </div>
          <div className="space-y-8">
            {/* Low Stock Alerts */}
            <LowStockAlertsVisual reloadKey={reloadKey} />
          </div>
        </section>
      </div>
    </div>
  );
}
