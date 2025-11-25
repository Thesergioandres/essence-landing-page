import { useEffect, useState } from "react";
import { analyticsService } from "../api/services";
import type {
  Averages,
  DistributorProfit,
  FinancialSummary,
  MonthlyProfitData,
  ProductProfit,
  TimelineData,
} from "../types";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyProfitData | null>(null);
  const [productProfits, setProductProfits] = useState<ProductProfit[]>([]);
  const [distributorProfits, setDistributorProfits] = useState<DistributorProfit[]>([]);
  const [averages, setAverages] = useState<Averages | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);

  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [timelineDays, setTimelineDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [monthly, products, distributors, avg, time, financial] = await Promise.all([
        analyticsService.getMonthlyProfit(),
        analyticsService.getProfitByProduct(),
        analyticsService.getProfitByDistributor(),
        analyticsService.getAverages("month"),
        analyticsService.getSalesTimeline(30),
        analyticsService.getFinancialSummary(),
      ]);

      setMonthlyData(monthly);
      setProductProfits(products);
      setDistributorProfits(distributors);
      setAverages(avg);
      setTimeline(time);
      setFinancialSummary(financial);
    } catch (error) {
      console.error("Error cargando analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    try {
      setLoading(true);
      const filters = {
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      };

      const [products, distributors, financial] = await Promise.all([
        analyticsService.getProfitByProduct(filters),
        analyticsService.getProfitByDistributor(filters),
        analyticsService.getFinancialSummary(filters),
      ]);

      setProductProfits(products);
      setDistributorProfits(distributors);
      setFinancialSummary(financial);
    } catch (error) {
      console.error("Error aplicando filtros:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePeriod = async (newPeriod: "day" | "week" | "month") => {
    setPeriod(newPeriod);
    try {
      const avg = await analyticsService.getAverages(newPeriod);
      setAverages(avg);
    } catch (error) {
      console.error("Error actualizando período:", error);
    }
  };

  const updateTimeline = async (days: number) => {
    setTimelineDays(days);
    try {
      const time = await analyticsService.getSalesTimeline(days);
      setTimeline(time);
    } catch (error) {
      console.error("Error actualizando timeline:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => row[h]).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Cargando analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">📊 Analytics y Reportes</h1>

      {/* Filtros de Fecha */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Fecha Fin</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={applyFilters}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Resumen Mensual */}
      {monthlyData && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">📅 Resumen del Mes</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Ganancia Total</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(monthlyData.currentMonth.totalProfit)}
              </p>
              <p className={`text-sm ${monthlyData.growthPercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatPercent(monthlyData.growthPercentage)} vs mes anterior
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Ingresos</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(monthlyData.currentMonth.revenue)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Ventas</p>
              <p className="text-2xl font-bold text-purple-600">{monthlyData.currentMonth.salesCount}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Ticket Promedio</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(monthlyData.averageTicket)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Mes Actual</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Ganancia Admin:</span>
                  <span className="font-semibold">{formatCurrency(monthlyData.currentMonth.adminProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ganancia Distribuidores:</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyData.currentMonth.distributorProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Costos:</span>
                  <span className="font-semibold">{formatCurrency(monthlyData.currentMonth.cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unidades Vendidas:</span>
                  <span className="font-semibold">{monthlyData.currentMonth.unitsCount}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Mes Anterior</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Ganancia Admin:</span>
                  <span className="font-semibold">{formatCurrency(monthlyData.lastMonth.adminProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ganancia Distribuidores:</span>
                  <span className="font-semibold">{formatCurrency(monthlyData.lastMonth.distributorProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Costos:</span>
                  <span className="font-semibold">{formatCurrency(monthlyData.lastMonth.cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unidades Vendidas:</span>
                  <span className="font-semibold">{monthlyData.lastMonth.unitsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen Financiero */}
      {financialSummary && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">💰 Resumen Financiero</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Ingresos Totales</p>
              <p className="text-xl font-bold">{formatCurrency(financialSummary.totalRevenue)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Costos Totales</p>
              <p className="text-xl font-bold">{formatCurrency(financialSummary.totalCost)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Ganancia Total</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(financialSummary.totalProfit)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Margen de Ganancia</p>
              <p className="text-xl font-bold">{financialSummary.profitMargin.toFixed(2)}%</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Ganancia Admin</p>
              <p className="text-xl font-bold">{formatCurrency(financialSummary.totalAdminProfit)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Ganancia Distribuidores</p>
              <p className="text-xl font-bold">{formatCurrency(financialSummary.totalDistributorProfit)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Productos Defectuosos</p>
              <p className="text-xl font-bold text-red-600">{financialSummary.defectiveUnits}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Tasa de Defectuosos</p>
              <p className="text-xl font-bold">{financialSummary.defectiveRate.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Promedios */}
      {averages && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">📈 Promedios</h2>
            <div className="flex gap-2">
              <button
                onClick={() => updatePeriod("day")}
                className={`px-4 py-2 rounded-md ${
                  period === "day" ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}
              >
                Día
              </button>
              <button
                onClick={() => updatePeriod("week")}
                className={`px-4 py-2 rounded-md ${
                  period === "week" ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => updatePeriod("month")}
                className={`px-4 py-2 rounded-md ${
                  period === "month" ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Ingresos / Día</p>
              <p className="text-xl font-bold">{formatCurrency(averages.averageRevenuePerDay)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Ganancia / Día</p>
              <p className="text-xl font-bold">{formatCurrency(averages.averageProfitPerDay)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Ventas / Día</p>
              <p className="text-xl font-bold">{averages.averageSalesPerDay.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Unidades / Día</p>
              <p className="text-xl font-bold">{averages.averageUnitsPerDay.toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ganancia por Producto */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">🏆 Ganancia por Producto</h2>
          <button
            onClick={() =>
              exportToCSV(
                productProfits.map((p) => ({
                  Producto: p.productName,
                  Cantidad: p.totalQuantity,
                  Ventas: p.totalSales,
                  Ingresos: p.totalRevenue,
                  Ganancia: p.totalProfit,
                  Margen: `${p.profitMargin.toFixed(2)}%`,
                })),
                "ganancia_por_producto"
              )
            }
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3 text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productProfits.slice(0, 10).map((product) => (
                <tr key={product.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.productImage && (
                        <img
                          src={product.productImage.url}
                          alt={product.productName}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <span className="font-medium">{product.productName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{product.totalQuantity}</td>
                  <td className="px-4 py-3 text-right">{product.totalSales}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(product.totalRevenue)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {formatCurrency(product.totalProfit)}
                  </td>
                  <td className="px-4 py-3 text-right">{product.profitMargin.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ganancia por Distribuidor */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">👥 Ganancia por Distribuidor</h2>
          <button
            onClick={() =>
              exportToCSV(
                distributorProfits.map((d) => ({
                  Distribuidor: d.distributorName,
                  Email: d.distributorEmail,
                  Ventas: d.totalSales,
                  Ingresos: d.totalRevenue,
                  "Ganancia Admin": d.totalAdminProfit,
                  "Ganancia Distribuidor": d.totalDistributorProfit,
                  "Venta Promedio": d.averageSale,
                })),
                "ganancia_por_distribuidor"
              )
            }
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Distribuidor</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Ganancia Admin</th>
                <th className="px-4 py-3 text-right">Ganancia Dist.</th>
                <th className="px-4 py-3 text-right">Venta Prom.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {distributorProfits.map((distributor) => (
                <tr key={distributor.distributorId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{distributor.distributorName}</p>
                      <p className="text-sm text-gray-500">{distributor.distributorEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{distributor.totalSales}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(distributor.totalRevenue)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {formatCurrency(distributor.totalAdminProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">
                    {formatCurrency(distributor.totalDistributorProfit)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(distributor.averageSale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline de Ventas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">📅 Timeline de Ventas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => updateTimeline(7)}
              className={`px-4 py-2 rounded-md ${timelineDays === 7 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            >
              7 días
            </button>
            <button
              onClick={() => updateTimeline(30)}
              className={`px-4 py-2 rounded-md ${timelineDays === 30 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            >
              30 días
            </button>
            <button
              onClick={() => updateTimeline(90)}
              className={`px-4 py-2 rounded-md ${timelineDays === 90 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            >
              90 días
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Costos</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {timeline.map((day) => (
                <tr key={day.date} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(day.date).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3 text-right">{day.sales}</td>
                  <td className="px-4 py-3 text-right">{day.units}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(day.revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(day.cost)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {formatCurrency(day.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
